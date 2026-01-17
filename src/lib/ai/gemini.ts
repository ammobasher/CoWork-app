import { GoogleGenerativeAI, GenerativeModel, Content, Part } from "@google/generative-ai";
import { IAIProvider, toolRegistry } from "./types";
import { Message, StreamChunk, ChatOptions, ToolDefinition } from "@/types";

export class GeminiProvider implements IAIProvider {
    readonly name = "gemini";
    readonly models = [
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ];

    private client: GoogleGenerativeAI | null = null;
    private apiKey: string | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.client = new GoogleGenerativeAI(apiKey);
    }

    isConfigured(): boolean {
        return this.client !== null && this.apiKey !== null;
    }

    private getModel(modelName: string = "gemini-2.0-flash-exp"): GenerativeModel {
        if (!this.client) {
            throw new Error("Gemini provider not configured. Please set API key.");
        }
        return this.client.getGenerativeModel({ model: modelName });
    }

    private convertMessages(messages: Message[]): Content[] {
        return messages
            .filter(m => m.role !== "system")
            .map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }] as Part[],
            }));
    }

    private getSystemInstruction(messages: Message[]): string | undefined {
        const systemMessage = messages.find(m => m.role === "system");
        return systemMessage?.content;
    }

    private convertToolsToGemini(tools: ToolDefinition[]): object[] {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    async *chat(
        messages: Message[],
        options?: ChatOptions
    ): AsyncGenerator<StreamChunk, void, unknown> {
        if (!this.client) {
            yield { type: "error", error: "Gemini provider not configured" };
            return;
        }

        try {
            const model = this.getModel();
            const systemInstruction = this.getSystemInstruction(messages);
            const history = this.convertMessages(messages.slice(0, -1));
            const lastMessage = messages[messages.length - 1];

            // Build generation config
            const generationConfig: Record<string, unknown> = {};
            if (options?.temperature !== undefined) {
                generationConfig.temperature = options.temperature;
            }
            if (options?.maxTokens !== undefined) {
                generationConfig.maxOutputTokens = options.maxTokens;
            }

            // Start chat
            const chat = model.startChat({
                history,
                generationConfig,
                ...(systemInstruction && { systemInstruction }),
            });

            // Stream response
            const result = await chat.sendMessageStream(lastMessage.content);

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    yield { type: "text", content: text };
                }

                // Check for function calls
                const candidates = chunk.candidates;
                if (candidates) {
                    for (const candidate of candidates) {
                        const parts = candidate.content?.parts;
                        if (parts) {
                            for (const part of parts) {
                                if ("functionCall" in part && part.functionCall) {
                                    yield {
                                        type: "tool_call",
                                        toolCall: {
                                            name: part.functionCall.name,
                                            arguments: part.functionCall.args as Record<string, unknown>,
                                            status: "pending",
                                        },
                                    };
                                }
                            }
                        }
                    }
                }
            }

            yield { type: "done" };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            yield { type: "error", error: errorMessage };
        }
    }

    async generateTitle(content: string): Promise<string> {
        if (!this.client) {
            return "New Conversation";
        }

        try {
            const model = this.getModel("gemini-1.5-flash");
            const result = await model.generateContent(
                `Generate a short, concise title (max 6 words) for a conversation that starts with this message. Return only the title, no quotes or punctuation:\n\n${content}`
            );
            return result.response.text().trim() || "New Conversation";
        } catch {
            return "New Conversation";
        }
    }
}
