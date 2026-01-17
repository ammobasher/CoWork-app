import Anthropic from "@anthropic-ai/sdk";
import { IAIProvider } from "./types";
import { Message, StreamChunk, ChatOptions } from "@/types";

export class AnthropicProvider implements IAIProvider {
    readonly name = "anthropic";
    readonly models = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ];

    private client: Anthropic | null = null;
    private apiKey: string | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.client = new Anthropic({ apiKey });
    }

    isConfigured(): boolean {
        return this.client !== null && this.apiKey !== null;
    }

    private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
        return messages
            .filter(m => m.role !== "system")
            .map(msg => ({
                role: msg.role === "assistant" ? "assistant" : "user",
                content: msg.content,
            }));
    }

    private getSystemPrompt(messages: Message[]): string | undefined {
        const systemMessage = messages.find(m => m.role === "system");
        return systemMessage?.content;
    }

    async *chat(
        messages: Message[],
        options?: ChatOptions
    ): AsyncGenerator<StreamChunk, void, unknown> {
        if (!this.client) {
            yield { type: "error", error: "Anthropic provider not configured" };
            return;
        }

        try {
            const systemPrompt = this.getSystemPrompt(messages);

            const stream = await this.client.messages.stream({
                model: "claude-3-5-sonnet-20241022",
                messages: this.convertMessages(messages),
                max_tokens: options?.maxTokens ?? 4096,
                ...(systemPrompt && { system: systemPrompt }),
            });

            for await (const event of stream) {
                if (event.type === "content_block_delta") {
                    const delta = event.delta;
                    if ("text" in delta) {
                        yield { type: "text", content: delta.text };
                    }
                }

                // Handle tool use
                if (event.type === "content_block_start") {
                    const block = event.content_block;
                    if (block.type === "tool_use") {
                        yield {
                            type: "tool_call",
                            toolCall: {
                                id: block.id,
                                name: block.name,
                                arguments: {},
                                status: "pending",
                            },
                        };
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
            const response = await this.client.messages.create({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 20,
                messages: [
                    {
                        role: "user",
                        content: `Generate a short, concise title (max 6 words) for a conversation that starts with this message. Return only the title, no quotes or punctuation:\n\n${content}`,
                    },
                ],
            });

            const textBlock = response.content.find(b => b.type === "text");
            return textBlock && "text" in textBlock ? textBlock.text.trim() : "New Conversation";
        } catch {
            return "New Conversation";
        }
    }
}
