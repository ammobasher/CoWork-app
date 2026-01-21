import type { ToolContext } from "@/lib/ai/tools";
import { toolRegistry } from "@/lib/ai/tools";

// Handle OpenAI chat with function calling
export async function handleOpenAIChat(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    apiKey: string,
    model: string | undefined,
    messages: Array<{ role: string; content: string }>,
    options: Record<string, unknown>,
    tools: ReturnType<typeof toolRegistry.list>,
    toolContext: ToolContext
) {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey });

    // Build message array that we'll mutate during tool calls
    type OpenAIMessage = {
        role: "user" | "assistant" | "system" | "tool";
        content: string | null;
        tool_call_id?: string;
        tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
        }>;
    };

    const openaiMessages: OpenAIMessage[] = messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
    }));

    // Convert tools to OpenAI format
    const openaiTools = tools.length > 0 ? tools.map(tool => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Record<string, unknown>,
        },
    })) : undefined;

    let maxIterations = 50; // Increased from 10 to support complex multi-step reasoning

    while (maxIterations > 0) {
        maxIterations--;

        const stream = await openai.chat.completions.create({
            model: model || "gpt-4o",
            messages: openaiMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
            stream: true,
            temperature: (options.temperature as number) ?? 0.7,
            max_tokens: options.maxTokens as number,
            tools: openaiTools,
        });

        let accumulatedText = "";
        const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                accumulatedText += delta.content;
                const data = JSON.stringify({ type: "text", content: delta.content });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const index = tc.index;
                    if (!toolCalls.has(index)) {
                        toolCalls.set(index, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
                    }
                    const existing = toolCalls.get(index)!;
                    if (tc.id) existing.id = tc.id;
                    if (tc.function?.name) existing.name = tc.function.name;
                    if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
            }
        }

        if (toolCalls.size > 0) {
            // Add assistant message with tool calls
            openaiMessages.push({
                role: "assistant",
                content: accumulatedText || null,
                tool_calls: Array.from(toolCalls.values()).map(tc => ({
                    id: tc.id,
                    type: "function" as const,
                    function: { name: tc.name, arguments: tc.arguments },
                })),
            });

            // Execute each tool
            for (const [, tc] of toolCalls) {
                const args = JSON.parse(tc.arguments || "{}");

                const toolCallData = JSON.stringify({
                    type: "tool_call",
                    name: tc.name,
                    args,
                });
                controller.enqueue(encoder.encode(`data: ${toolCallData}\n\n`));

                try {
                    const result = await toolRegistry.execute(tc.name, args, toolContext);

                    const toolResultData = JSON.stringify({
                        type: "tool_result",
                        name: tc.name,
                        result,
                    });
                    controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`));

                    openaiMessages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: JSON.stringify(result),
                    });
                } catch (error) {
                    const errorResult = {
                        success: false,
                        error: error instanceof Error ? error.message : "Tool execution failed",
                    };

                    openaiMessages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: JSON.stringify(errorResult),
                    });
                }
            }
        } else {
            break;
        }
    }
}
