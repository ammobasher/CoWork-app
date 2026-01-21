import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ModelInfo {
    id: string;
    name: string;
    description?: string;
    contextWindow?: number;
}

interface ModelsResponse {
    provider: string;
    models: ModelInfo[];
    error?: string;
}

// Fetch Gemini models from Google AI API
async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch Gemini models: ${response.status}`);
        }

        const data = await response.json();

        return data.models
            ?.filter((m: { name: string }) =>
                m.name.includes('gemini') &&
                !m.name.includes('embedding') &&
                !m.name.includes('vision')
            )
            .map((m: { name: string; displayName?: string; description?: string }) => ({
                id: m.name.replace('models/', ''),
                name: m.displayName || m.name.replace('models/', ''),
                description: m.description,
            })) || [];
    } catch (error) {
        console.error('Error fetching Gemini models:', error);
        return [
            { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash (Experimental)" },
            { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
        ];
    }
}

// Fetch OpenAI models from OpenAI API
async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
    try {
        const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch OpenAI models: ${response.status}`);
        }

        const data = await response.json();

        // Filter to only show GPT models suitable for chat
        return data.data
            ?.filter((m: { id: string }) =>
                m.id.includes('gpt-4') || m.id.includes('gpt-3.5')
            )
            .sort((a: { id: string }, b: { id: string }) => b.id.localeCompare(a.id))
            .slice(0, 10)
            .map((m: { id: string }) => ({
                id: m.id,
                name: m.id,
            })) || [];
    } catch (error) {
        console.error('Error fetching OpenAI models:', error);
        return [
            { id: "gpt-4o", name: "GPT-4o" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini" },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        ];
    }
}

// Fetch Anthropic models (Anthropic doesn't have a list models endpoint, so we use known models)
async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
    // Anthropic doesn't provide a models list API, so we return known models
    // We can validate the API key by making a simple request
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "hi" }],
            }),
        });

        // Even if it fails (rate limit, etc), if we get a response the key format is valid
        if (response.status === 401) {
            throw new Error("Invalid API key");
        }
    } catch (error) {
        console.error('Error validating Anthropic API key:', error);
    }

    // Return known Claude models
    return [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Most intelligent model" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Fast and efficient" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Powerful for complex tasks" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", description: "Balanced performance" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fast responses" },
    ];
}

export async function POST(request: NextRequest) {
    try {
        const { provider, apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json(
                { error: "API key is required" },
                { status: 400 }
            );
        }

        let models: ModelInfo[] = [];

        switch (provider) {
            case "gemini":
                models = await fetchGeminiModels(apiKey);
                break;
            case "openai":
                models = await fetchOpenAIModels(apiKey);
                break;
            case "anthropic":
                models = await fetchAnthropicModels(apiKey);
                break;
            default:
                return NextResponse.json(
                    { error: "Unknown provider" },
                    { status: 400 }
                );
        }

        const response: ModelsResponse = {
            provider,
            models,
        };

        return NextResponse.json(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
