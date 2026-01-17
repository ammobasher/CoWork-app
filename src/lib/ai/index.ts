import { providerRegistry, toolRegistry, IAIProvider } from "./types";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { registerBuiltinTools } from "./tools";

// Provider instances
export const geminiProvider = new GeminiProvider();
export const openaiProvider = new OpenAIProvider();
export const anthropicProvider = new AnthropicProvider();

// Register all providers
providerRegistry.register(geminiProvider);
providerRegistry.register(openaiProvider);
providerRegistry.register(anthropicProvider);

// Set default active provider
providerRegistry.setActive("gemini");

// Register built-in tools
registerBuiltinTools();

/**
 * Configure a provider with an API key
 */
export function configureProvider(
    providerName: string,
    apiKey: string
): void {
    const provider = providerRegistry.get(providerName);
    if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
    }

    // Call setApiKey if it exists on the provider
    if ("setApiKey" in provider && typeof provider.setApiKey === "function") {
        (provider as { setApiKey: (key: string) => void }).setApiKey(apiKey);
    }
}

/**
 * Get the currently active provider
 */
export function getActiveProvider(): IAIProvider | undefined {
    return providerRegistry.getActive();
}

/**
 * List all available providers
 */
export function listProviders(): { name: string; configured: boolean; models: string[] }[] {
    return providerRegistry.list().map(name => {
        const provider = providerRegistry.get(name)!;
        return {
            name,
            configured: provider.isConfigured(),
            models: provider.models,
        };
    });
}

// Re-export everything
export { providerRegistry, toolRegistry };
export type { IAIProvider } from "./types";
