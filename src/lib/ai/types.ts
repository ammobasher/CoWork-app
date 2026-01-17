import { Message, StreamChunk, ChatOptions, ToolDefinition } from "@/types";

/**
 * Abstract AI Provider interface for multi-provider support
 */
export interface IAIProvider {
    readonly name: string;
    readonly models: string[];

    /**
     * Stream a chat response
     */
    chat(
        messages: Message[],
        options?: ChatOptions
    ): AsyncGenerator<StreamChunk, void, unknown>;

    /**
     * Generate a title for a conversation based on first message
     */
    generateTitle(content: string): Promise<string>;

    /**
     * Check if the provider is configured and ready
     */
    isConfigured(): boolean;
}

/**
 * Provider registry for managing multiple AI providers
 */
export class ProviderRegistry {
    private providers: Map<string, IAIProvider> = new Map();
    private activeProvider: string | null = null;

    register(provider: IAIProvider): void {
        this.providers.set(provider.name, provider);
    }

    get(name: string): IAIProvider | undefined {
        return this.providers.get(name);
    }

    getActive(): IAIProvider | undefined {
        if (!this.activeProvider) return undefined;
        return this.providers.get(this.activeProvider);
    }

    setActive(name: string): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider ${name} not found`);
        }
        this.activeProvider = name;
    }

    list(): string[] {
        return Array.from(this.providers.keys());
    }

    listConfigured(): string[] {
        return Array.from(this.providers.entries())
            .filter(([_, provider]) => provider.isConfigured())
            .map(([name]) => name);
    }
}

// Global provider registry instance
export const providerRegistry = new ProviderRegistry();

/**
 * Tool registration and execution system
 */
export interface Tool {
    definition: ToolDefinition;
    execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        this.tools.set(tool.definition.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    list(): ToolDefinition[] {
        return Array.from(this.tools.values()).map(t => t.definition);
    }

    async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }
        return tool.execute(args);
    }
}

// Global tool registry instance
export const toolRegistry = new ToolRegistry();
