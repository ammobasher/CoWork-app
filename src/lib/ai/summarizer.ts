/**
 * Message Summarizer
 * 
 * Uses LLM to create intelligent summaries of conversation history,
 * preserving key context while reducing token count.
 */

import { Message } from './context-manager';

export interface SummaryResult {
    summary: string;
    keyPoints: string[];
    filesDiscussed: string[];
    decisionsAndActions: string[];
}

const SUMMARY_PROMPT = `You are a conversation summarizer. Given the conversation below, create a concise but comprehensive summary.

IMPORTANT: Preserve these key elements:
1. Main topics and goals discussed
2. Files, code, or artifacts mentioned (with paths if available)
3. Decisions made or actions taken
4. Important context the AI needs to continue helping
5. Any errors encountered and their resolutions

Format your response as:
## Summary
[2-4 sentence overview of the conversation]

## Key Files/Code
[List any files, functions, or code discussed]

## Decisions & Actions
[List any decisions made or actions taken]

## Important Context
[Any critical context needed to continue the conversation]

CONVERSATION TO SUMMARIZE:
`;

/**
 * Summarize a set of messages using the LLM
 */
export async function summarizeMessages(
    messages: Message[],
    provider: string,
    apiKey: string,
    model?: string
): Promise<SummaryResult> {
    // Format messages for summarization
    const conversationText = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n---\n\n');

    const prompt = SUMMARY_PROMPT + conversationText;

    try {
        let summaryText: string;

        if (provider === 'gemini') {
            summaryText = await callGemini(prompt, apiKey, model);
        } else if (provider === 'openai') {
            summaryText = await callOpenAI(prompt, apiKey, model);
        } else if (provider === 'anthropic') {
            summaryText = await callAnthropic(prompt, apiKey, model);
        } else {
            throw new Error(`Unknown provider: ${provider}`);
        }

        // Parse the structured summary
        return parseSummary(summaryText);
    } catch (error) {
        console.error('[Summarizer] Error:', error);

        // Fallback: create basic summary
        return {
            summary: `Previous conversation covered ${messages.length} messages. Key topics discussed but summary generation failed.`,
            keyPoints: [],
            filesDiscussed: [],
            decisionsAndActions: [],
        };
    }
}

/**
 * Parse structured summary from LLM response
 */
function parseSummary(text: string): SummaryResult {
    const result: SummaryResult = {
        summary: '',
        keyPoints: [],
        filesDiscussed: [],
        decisionsAndActions: [],
    };

    // Extract Summary section
    const summaryMatch = text.match(/## Summary\s*\n([\s\S]*?)(?=\n## |$)/i);
    if (summaryMatch) {
        result.summary = summaryMatch[1].trim();
    } else {
        // If no structured format, use the whole text
        result.summary = text.slice(0, 500);
    }

    // Extract Key Files section
    const filesMatch = text.match(/## Key Files\/Code\s*\n([\s\S]*?)(?=\n## |$)/i);
    if (filesMatch) {
        result.filesDiscussed = filesMatch[1]
            .split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l.length > 0);
    }

    // Extract Decisions section
    const decisionsMatch = text.match(/## Decisions & Actions\s*\n([\s\S]*?)(?=\n## |$)/i);
    if (decisionsMatch) {
        result.decisionsAndActions = decisionsMatch[1]
            .split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l.length > 0);
    }

    // Extract Important Context
    const contextMatch = text.match(/## Important Context\s*\n([\s\S]*?)(?=\n## |$)/i);
    if (contextMatch) {
        result.keyPoints = contextMatch[1]
            .split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l.length > 0);
    }

    return result;
}

/**
 * Call Gemini for summarization
 */
async function callGemini(prompt: string, apiKey: string, model?: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    const genModel = client.getGenerativeModel({
        model: model || 'gemini-2.0-flash-exp',
    });

    const response = await genModel.generateContent(prompt);
    return response.response.text();
}

/**
 * Call OpenAI for summarization
 */
async function callOpenAI(prompt: string, apiKey: string, model?: string): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
        model: model || 'gpt-4o-mini', // Use cheaper model for summarization
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic for summarization
 */
async function callAnthropic(prompt: string, apiKey: string, model?: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
        model: model || 'claude-3-haiku-20240307', // Use cheaper model for summarization
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
}
