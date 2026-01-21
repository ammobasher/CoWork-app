import type { ToolContext } from "@/lib/ai/tools";
import { toolRegistry } from "@/lib/ai/tools";

// Handle Gemini chat with function calling
export async function handleGeminiChat(
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

    // Extract system message for Gemini
    const systemMessage = messages.find(msg => msg.role === "system");
    const nonSystemMessages = messages.filter(msg => msg.role !== "system");

    const genModel = genAI.getGenerativeModel({
        model: model || "gemini-2.0-flash-exp",
        ...(systemMessage && { systemInstruction: systemMessage.content }),
        ...(functionDeclarations && {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: [{ functionDeclarations }] as any,
            toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
        }),
    });

    // Convert messages to Gemini format (excluding system message)
    const history = nonSystemMessages.slice(0, -1).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];

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
