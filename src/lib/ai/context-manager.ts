/**
 * Context Manager
 * 
 * Handles token estimation and intelligent message compaction
 * to prevent exceeding provider context window limits.
 */

import { summarizeMessages, SummaryResult } from './summarizer';

export interface Message {
    role: string;
    content: string;
}

export interface CompactionResult {
    messages: Message[];
    wasCompacted: boolean;
    originalTokens: number;
    compactedTokens: number;
    summaryMessage?: string;
}

// Token limits by provider and model (approximate)
const TOKEN_LIMITS: Record<string, Record<string, number>> = {
    gemini: {
        'gemini-2.0-flash-exp': 1000000,
        'gemini-1.5-pro': 2000000,
        'gemini-1.5-flash': 1000000,
        'default': 1000000,
    },
    openai: {
        'gpt-4o': 128000,
        'gpt-4o-mini': 128000,
        'gpt-4-turbo': 128000,
        'gpt-4': 8192,
        'gpt-3.5-turbo': 16385,
        'default': 128000,
    },
    anthropic: {
        'claude-3-5-sonnet-20241022': 200000,
        'claude-3-5-haiku-20241022': 200000,
        'claude-3-opus-20240229': 200000,
        'claude-3-sonnet-20240229': 200000,
        'claude-3-haiku-20240307': 200000,
        'default': 200000,
    },
};

// Target usage percentage (trigger compaction before hitting limit)
const TARGET_USAGE = 0.75; // 75% of limit

// Minimum messages to keep in full (never compact these)
const MIN_RECENT_MESSAGES = 6;

/**
 * Estimate token count for text
 * Uses approximation: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation based on common patterns
    // - Average English word is ~4-5 chars + space
    // - Most tokenizers produce ~0.75 tokens per word
    // - Roughly 4 chars per token is a safe approximation
    return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for an array of messages
 */
export function estimateMessagesTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        // Add overhead for role and message structure (~4 tokens per message)
        total += 4;
        total += estimateTokens(msg.content);
    }
    return total;
}

/**
 * Get token limit for a provider/model combination
 */
export function getTokenLimit(provider: string, model?: string): number {
    const providerLimits = TOKEN_LIMITS[provider] || TOKEN_LIMITS.openai;
    if (model && providerLimits[model]) {
        return providerLimits[model];
    }
    return providerLimits.default || 128000;
}

/**
 * Check if messages need compaction
 */
export function shouldCompact(
    messages: Message[],
    provider: string,
    model?: string
): boolean {
    const currentTokens = estimateMessagesTokens(messages);
    const limit = getTokenLimit(provider, model);
    const threshold = limit * TARGET_USAGE;

    return currentTokens > threshold && messages.length > MIN_RECENT_MESSAGES;
}

/**
 * Compact messages by summarizing older ones
 * 
 * Strategy:
 * 1. Keep system message always
 * 2. Keep last N messages in full
 * 3. Summarize everything in between
 */
export async function compactMessages(
    messages: Message[],
    provider: string,
    apiKey: string,
    model?: string
): Promise<CompactionResult> {
    const originalTokens = estimateMessagesTokens(messages);

    // Check if compaction is needed
    if (!shouldCompact(messages, provider, model)) {
        return {
            messages,
            wasCompacted: false,
            originalTokens,
            compactedTokens: originalTokens,
        };
    }

    // Separate system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // If too few messages, don't compact
    if (nonSystemMessages.length <= MIN_RECENT_MESSAGES) {
        return {
            messages,
            wasCompacted: false,
            originalTokens,
            compactedTokens: originalTokens,
        };
    }

    // Split: older messages to summarize, recent messages to keep
    const splitPoint = nonSystemMessages.length - MIN_RECENT_MESSAGES;
    const messagesToSummarize = nonSystemMessages.slice(0, splitPoint);
    const recentMessages = nonSystemMessages.slice(splitPoint);

    try {
        // Summarize older messages
        const summary = await summarizeMessages(
            messagesToSummarize,
            provider,
            apiKey,
            model
        );

        // Build compacted message array
        const compactedMessages: Message[] = [];

        // Add system message first if present
        if (systemMessage) {
            compactedMessages.push(systemMessage);
        }

        // Add summary as a system message
        const summaryMessage: Message = {
            role: 'system',
            content: `[CONVERSATION SUMMARY - ${messagesToSummarize.length} earlier messages]\n\n${summary.summary}\n\n[END SUMMARY - Recent messages follow]`,
        };
        compactedMessages.push(summaryMessage);

        // Add recent messages
        compactedMessages.push(...recentMessages);

        const compactedTokens = estimateMessagesTokens(compactedMessages);

        return {
            messages: compactedMessages,
            wasCompacted: true,
            originalTokens,
            compactedTokens,
            summaryMessage: summary.summary,
        };
    } catch (error) {
        console.error('[ContextManager] Summarization failed:', error);

        // Fallback: simple truncation of oldest messages
        const fallbackMessages: Message[] = [];
        if (systemMessage) {
            fallbackMessages.push(systemMessage);
        }

        // Keep only recent messages
        fallbackMessages.push(...recentMessages);

        return {
            messages: fallbackMessages,
            wasCompacted: true,
            originalTokens,
            compactedTokens: estimateMessagesTokens(fallbackMessages),
        };
    }
}

/**
 * Get compaction stats for display
 */
export function getCompactionStats(result: CompactionResult): string {
    if (!result.wasCompacted) {
        return `Context: ${result.originalTokens} tokens (no compaction needed)`;
    }

    const reduction = Math.round(
        (1 - result.compactedTokens / result.originalTokens) * 100
    );

    return `Context compacted: ${result.originalTokens} → ${result.compactedTokens} tokens (${reduction}% reduction)`;
}
