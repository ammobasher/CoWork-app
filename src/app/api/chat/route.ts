import { NextRequest, NextResponse } from "next/server";
import { registerBuiltinTools, toolRegistry } from "@/lib/ai/tools";
import type { ToolContext } from "@/lib/ai/tools";

// Use Node.js runtime for this route (needed for child_process in sandbox)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Register tools on first load
registerBuiltinTools();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            messages,
            provider = "gemini",
            model,
            apiKey,
            options = {},
            enableTools = true,
            apiKeys = {} // Additional API keys for tools (tavily, etc.)
        } = body;

        if (!apiKey) {
            return NextResponse.json(
                { error: "API key is required" },
                { status: 400 }
            );
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Messages array is required" },
                { status: 400 }
            );
        }

        // Build tool context for tool execution
        const toolContext: ToolContext = {
            apiKeys: {
                openai: apiKeys.openai || apiKey,
                tavily: apiKeys.tavily,
                anthropic: apiKeys.anthropic,
            },
        };

        // Get tool definitions for function calling
        const tools = enableTools ? toolRegistry.list() : [];

        // Create streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (provider === "gemini") {
                        await handleGeminiChat(
                            controller, encoder, apiKey, model, messages, options, tools, toolContext
                        );
                    } else if (provider === "openai") {
                        await handleOpenAIChat(
                            controller, encoder, apiKey, model, messages, options, tools, toolContext
                        );
                    } else if (provider === "anthropic") {
                        await handleAnthropicChat(
                            controller, encoder, apiKey, model, messages, options, tools, toolContext
                        );
                    }

                    // Send done signal
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                    controller.close();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error";
                    const data = JSON.stringify({ type: "error", error: errorMessage });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// Handle Gemini chat with function calling
async function handleGeminiChat(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    apiKey: string,
    model: string | undefined,
    messages: Array<{ role: string; content: string }>,
    options: Record<string, unknown>,
    tools: ReturnType<typeof toolRegistry.list>,
    toolContext: ToolContext
) {
    const { GoogleGenerativeAI, FunctionCallingMode } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    // Build function declarations for Gemini (cast to any to avoid strict SDK type checking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionDeclarations: any[] | undefined = tools.length > 0 ? tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
    })) : undefined;

    const genModel = genAI.getGenerativeModel({
        model: model || "gemini-2.0-flash-exp",
        ...(functionDeclarations && {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: [{ functionDeclarations }] as any,
            toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
        }),
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const chat = genModel.startChat({
        history,
        generationConfig: {
            temperature: (options.temperature as number) ?? 0.7,
            maxOutputTokens: (options.maxTokens as number) ?? 8192,
        },
    });

    // Loop to handle function calls
    let currentContent: string | { functionResponse: { name: string; response: unknown } } = lastMessage.content;
    let maxIterations = 50; // Increased from 10 to support complex multi-step reasoning

    while (maxIterations > 0) {
        maxIterations--;

        // Send message (either text or function response)
        const messageToSend = typeof currentContent === "string"
            ? currentContent
            : { functionResponse: currentContent.functionResponse };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await chat.sendMessageStream(messageToSend as any);
        let functionCall: { name: string; args: Record<string, unknown> } | null = null;

        for await (const chunk of result.stream) {
            const candidate = chunk.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    // Check for function calls
                    if ("functionCall" in part && part.functionCall) {
                        functionCall = {
                            name: part.functionCall.name,
                            args: (part.functionCall.args || {}) as Record<string, unknown>,
                        };
                        const toolCallData = JSON.stringify({
                            type: "tool_call",
                            name: functionCall.name,
                            args: functionCall.args,
                        });
                        controller.enqueue(encoder.encode(`data: ${toolCallData}\n\n`));
                    }
                    // Handle text
                    if ("text" in part && part.text) {
                        const data = JSON.stringify({ type: "text", content: part.text });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                }
            }
        }

        // If there was a function call, execute it and continue
        if (functionCall) {
            try {
                const toolResult = await toolRegistry.execute(
                    functionCall.name,
                    functionCall.args,
                    toolContext
                );

                const toolResultData = JSON.stringify({
                    type: "tool_result",
                    name: functionCall.name,
                    result: toolResult,
                });
                controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`));

                // Continue with function response
                currentContent = {
                    functionResponse: {
                        name: functionCall.name,
                        response: toolResult,
                    },
                };
            } catch (error) {
                const errorResult = {
                    success: false,
                    error: error instanceof Error ? error.message : "Tool execution failed",
                };

                const toolResultData = JSON.stringify({
                    type: "tool_result",
                    name: functionCall.name,
                    result: errorResult,
                });
                controller.enqueue(encoder.encode(`data: ${toolResultData}\n\n`));

                currentContent = {
                    functionResponse: {
                        name: functionCall.name,
                        response: errorResult,
                    },
                };
            }
        } else {
            break;
        }
    }
}

// Handle OpenAI chat with function calling
async function handleOpenAIChat(
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

// Handle Anthropic chat with function calling
async function handleAnthropicChat(
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
