import { NextRequest, NextResponse } from "next/server";
import { registerBuiltinTools, toolRegistry } from "@/lib/ai/tools";
import { handleGeminiChat } from "./handlers/handleGeminiChat";
import { handleOpenAIChat } from "./handlers/handleOpenAIChat";
import { handleAnthropicChat } from "./handlers/handleAnthropicChat";
import { compactMessages, shouldCompact, estimateMessagesTokens } from "@/lib/ai/context-manager";
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

        // Check if context compaction is needed
        let processedMessages = messages;
        let compactionResult = null;

        if (shouldCompact(messages, provider, model)) {
            try {
                compactionResult = await compactMessages(messages, provider, apiKey, model);
                processedMessages = compactionResult.messages;
                console.log(`[Chat] Context compacted: ${compactionResult.originalTokens} → ${compactionResult.compactedTokens} tokens`);
            } catch (error) {
                console.error('[Chat] Compaction failed, using original messages:', error);
            }
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
                    // Notify client if compaction occurred
                    if (compactionResult?.wasCompacted) {
                        const compactionInfo = JSON.stringify({
                            type: "compaction",
                            original_tokens: compactionResult.originalTokens,
                            compacted_tokens: compactionResult.compactedTokens,
                            message: `Context compacted: ${compactionResult.originalTokens} → ${compactionResult.compactedTokens} tokens`,
                        });
                        controller.enqueue(encoder.encode(`data: ${compactionInfo}\n\n`));
                    }

                    if (provider === "gemini") {
                        await handleGeminiChat(
                            controller, encoder, apiKey, model, processedMessages, options, tools, toolContext
                        );
                    } else if (provider === "openai") {
                        await handleOpenAIChat(
                            controller, encoder, apiKey, model, processedMessages, options, tools, toolContext
                        );
                    } else if (provider === "anthropic") {
                        await handleAnthropicChat(
                            controller, encoder, apiKey, model, processedMessages, options, tools, toolContext
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
