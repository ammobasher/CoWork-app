import OpenAI from "openai";
import { IAIProvider } from "./types";
import { Message, StreamChunk, ChatOptions } from "@/types";

export class OpenAIProvider implements IAIProvider {
    readonly name = "openai";
    readonly models = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
    ];

    private client: OpenAI | null = null;
    private apiKey: string | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    }

    isConfigured(): boolean {
        return this.client !== null && this.apiKey !== null;
    }

    private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
        return messages.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content,
        }));
    }

    async *chat(
        messages: Message[],
        options?: ChatOptions
    ): AsyncGenerator<StreamChunk, void, unknown> {
        if (!this.client) {
            yield { type: "error", error: "OpenAI provider not configured" };
            return;
        }

        try {
            const stream = await this.client.chat.completions.create({
                model: options?.maxTokens ? "gpt-4o" : "gpt-4o-mini",
                messages: this.convertMessages(messages),
                stream: true,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens,
            });

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;

                if (delta?.content) {
                    yield { type: "text", content: delta.content };
                }

                // Handle tool calls
                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        if (toolCall.function) {
                            yield {
                                type: "tool_call",
                                toolCall: {
                                    id: toolCall.id,
                                    name: toolCall.function.name,
                                    arguments: toolCall.function.arguments
                                        ? JSON.parse(toolCall.function.arguments)
                                        : {},
                                    status: "pending",
                                },
                            };
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
            const response = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: `Generate a short, concise title (max 6 words) for a conversation that starts with this message. Return only the title, no quotes or punctuation:\n\n${content}`,
                    },
                ],
                max_tokens: 20,
            });

            return response.choices[0]?.message?.content?.trim() || "New Conversation";
        } catch {
            return "New Conversation";
        }
    }
}
