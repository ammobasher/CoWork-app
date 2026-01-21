import type { ToolContext } from "@/lib/ai/tools";
import { toolRegistry } from "@/lib/ai/tools";

// Handle Anthropic chat with function calling
export async function handleAnthropicChat(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    apiKey: string,
    model: string | undefined,
    messages: Array<{ role: string; content: string }>,
    options: Record<string, unknown>,
    tools: ReturnType<typeof toolRegistry.list>,
    toolContext: ToolContext
) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey });

    const systemMessage = messages.find((m) => m.role === "system");

    // Use any type for Anthropic messages due to complex union types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anthropicMessages: any[] = messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
        }));

    // Convert tools to Anthropic format
    const anthropicTools = tools.length > 0 ? tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as Record<string, unknown>,
    })) : undefined;

    let maxIterations = 50; // Increased from 10 to support complex multi-step reasoning

    while (maxIterations > 0) {
        maxIterations--;

        const response = await anthropic.messages.create({
            model: model || "claude-3-5-sonnet-20241022",
            messages: anthropicMessages,
            max_tokens: (options.maxTokens as number) ?? 4096,
            stream: true,
            ...(systemMessage && { system: systemMessage.content }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(anthropicTools && { tools: anthropicTools as any }),
        });

        let accumulatedText = "";
        const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
        let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

        for await (const event of response) {
            if (event.type === "content_block_start") {
                const block = event.content_block;
                if (block.type === "tool_use") {
                    currentToolUse = { id: block.id, name: block.name, inputJson: "" };
                }
            }

            if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                    accumulatedText += event.delta.text;
                    const data = JSON.stringify({ type: "text", content: event.delta.text });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                if (event.delta.type === "input_json_delta" && currentToolUse) {
                    currentToolUse.inputJson += event.delta.partial_json;
                }
            }

            if (event.type === "content_block_stop" && currentToolUse) {
                try {
                    const input = JSON.parse(currentToolUse.inputJson || "{}");
                    toolUses.push({
                        id: currentToolUse.id,
                        name: currentToolUse.name,
                        input,
                    });
                } catch {
                    toolUses.push({
                        id: currentToolUse.id,
                        name: currentToolUse.name,
                        input: {},
                    });
                }
                currentToolUse = null;
            }
        }

        if (toolUses.length > 0) {
            // Build content array for assistant message
            const assistantContent: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];
            if (accumulatedText) {
                assistantContent.push({ type: "text", text: accumulatedText });
            }
            for (const tu of toolUses) {
                assistantContent.push({
                    type: "tool_use",
                    id: tu.id,
                    name: tu.name,
                    input: tu.input,
                });
            }

            anthropicMessages.push({
                role: "assistant",
                content: assistantContent,
            });

            // Execute tools
            const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

            for (const tu of toolUses) {
                const toolCallData = JSON.stringify({
                    type: "tool_call",
                    name: tu.name,
                    args: tu.input,
                });
                controller.enqueue(encoder.encode(`data: ${toolCallData}\n\n`));

                try {
                    const result = await toolRegistry.execute(tu.name, tu.input, toolContext);

                    const toolResultData = JSON.stringify({
                        type: "tool_result",
                        name: tu.name,
                        result,
                    });
                    controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`));

                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: tu.id,
                        content: JSON.stringify(result),
                    });
                } catch (error) {
                    const errorResult = {
                        success: false,
                        error: error instanceof Error ? error.message : "Tool execution failed",
                    };

                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: tu.id,
                        content: JSON.stringify(errorResult),
                    });
                }
            }

            anthropicMessages.push({
                role: "user",
                content: toolResults,
            });
        } else {
            break;
        }
    }
}
