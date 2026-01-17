import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, provider = "gemini", model, apiKey, options = {} } = body;

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

        // Create streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Dynamic import based on provider
                    if (provider === "gemini") {
                        const { GoogleGenerativeAI } = await import("@google/generative-ai");
                        const genAI = new GoogleGenerativeAI(apiKey);
                        const genModel = genAI.getGenerativeModel({
                            model: model || "gemini-2.0-flash-exp"
                        });

                        // Convert messages to Gemini format
                        const history = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
                            role: msg.role === "assistant" ? "model" : "user",
                            parts: [{ text: msg.content }],
                        }));

                        const lastMessage = messages[messages.length - 1];

                        const chat = genModel.startChat({
                            history,
                            generationConfig: {
                                temperature: options.temperature ?? 0.7,
                                maxOutputTokens: options.maxTokens ?? 8192,
                            },
                        });

                        const result = await chat.sendMessageStream(lastMessage.content);

                        for await (const chunk of result.stream) {
                            const text = chunk.text();
                            if (text) {
                                const data = JSON.stringify({ type: "text", content: text });
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                            }
                        }
                    } else if (provider === "openai") {
                        const OpenAI = (await import("openai")).default;
                        const openai = new OpenAI({ apiKey });

                        const openaiMessages = messages.map((msg: { role: string; content: string }) => ({
                            role: msg.role as "user" | "assistant" | "system",
                            content: msg.content,
                        }));

                        const stream = await openai.chat.completions.create({
                            model: model || "gpt-4o",
                            messages: openaiMessages,
                            stream: true,
                            temperature: options.temperature ?? 0.7,
                            max_tokens: options.maxTokens,
                        });

                        for await (const chunk of stream) {
                            const text = chunk.choices[0]?.delta?.content;
                            if (text) {
                                const data = JSON.stringify({ type: "text", content: text });
                                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                            }
                        }
                    } else if (provider === "anthropic") {
                        const Anthropic = (await import("@anthropic-ai/sdk")).default;
                        const anthropic = new Anthropic({ apiKey });

                        const anthropicMessages = messages
                            .filter((msg: { role: string }) => msg.role !== "system")
                            .map((msg: { role: string; content: string }) => ({
                                role: msg.role === "assistant" ? "assistant" : "user",
                                content: msg.content,
                            }));

                        const systemMessage = messages.find((m: { role: string }) => m.role === "system");

                        const stream = await anthropic.messages.stream({
                            model: model || "claude-3-5-sonnet-20241022",
                            messages: anthropicMessages,
                            max_tokens: options.maxTokens ?? 4096,
                            ...(systemMessage && { system: systemMessage.content }),
                        });

                        for await (const event of stream) {
                            if (event.type === "content_block_delta") {
                                const delta = event.delta;
                                if ("text" in delta) {
                                    const data = JSON.stringify({ type: "text", content: delta.text });
                                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                                }
                            }
                        }
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
