/**
 * Agent Reflector
 *
 * Analyzes task results, identifies issues, and suggests corrections
 */

import { Task, ReflectionResult } from './types';

export class AgentReflector {
  private provider: 'anthropic' | 'openai' | 'gemini';
  private apiKey: string;
  private model?: string;

  constructor(config: {
    provider: 'anthropic' | 'openai' | 'gemini';
    apiKey: string;
    model?: string;
  }) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  /**
   * Analyze a task result and reflect on success/issues
   */
  async analyzeResult(
    task: Task,
    expectedOutcome?: string
  ): Promise<ReflectionResult> {
    const reflectionPrompt = `
Analyze the following task execution and provide detailed feedback.

Task: ${task.description}
Tool Used: ${task.tool || 'None'}
Status: ${task.status}
${task.result ? `Result: ${this.serializeResult(task.result)}` : ''}
${task.error ? `Error: ${task.error}` : ''}
${expectedOutcome ? `Expected Outcome: ${expectedOutcome}` : ''}

Evaluate:
1. Did the task succeed? (boolean)
2. Confidence level in the result (0.0 to 1.0)
3. Any issues or concerns? (list)
4. Suggestions for improvement? (list)
5. Should this task be retried with a different approach? (boolean)
6. If retry needed, what alternative approach would you suggest?

Respond in JSON format:
{
  "success": true/false,
  "confidence": 0.0-1.0,
  "issues": ["issue 1", "issue 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "shouldRetry": true/false,
  "alternativeApproach": {
    "description": "...",
    "tool": "...",
    "args": {...}
  }
}
`;

    try {
      const response = await this.callLLM(reflectionPrompt);
      return this.parseReflectionResponse(response);
    } catch (error) {
      // Fallback reflection based on task status
      return this.createFallbackReflection(task);
    }
  }

  /**
   * Propose a correction for a failed task
   */
  async proposeCorrection(
    failedTask: Task,
    error: Error | string
  ): Promise<Task | null> {
    const correctionPrompt = `
The following task failed. Propose an alternative approach.

Task: ${failedTask.description}
Tool Used: ${failedTask.tool}
Arguments: ${JSON.stringify(failedTask.args, null, 2)}
Error: ${error instanceof Error ? error.message : error}

Consider:
1. Using a different tool
2. Modifying the arguments
3. Breaking into smaller steps
4. Working around the limitation

Respond with JSON:
{
  "canFix": true/false,
  "alternative": {
    "description": "...",
    "tool": "...",
    "args": {...},
    "reasoning": "why this approach is better"
  }
}

If the task is fundamentally impossible, set canFix to false.
`;

    try {
      const response = await this.callLLM(correctionPrompt);
      const parsed = JSON.parse(this.extractJSON(response));

      if (!parsed.canFix) {
        return null;
      }

      const correctedTask: Task = {
        id: `${failedTask.id}-retry`,
        description: parsed.alternative.description,
        tool: parsed.alternative.tool,
        args: parsed.alternative.args,
        status: 'pending',
        dependencies: failedTask.dependencies,
        metadata: {
          ...failedTask.metadata,
          tags: [...(failedTask.metadata?.tags || []), 'retry', 'corrected'],
        },
      };

      return correctedTask;
    } catch (error) {
      console.error('Failed to generate correction:', error);
      return null;
    }
  }

  /**
   * Analyze a series of tasks to identify patterns
   */
  async analyzePatterns(tasks: Task[]): Promise<{
    commonIssues: string[];
    successPatterns: string[];
    recommendations: string[];
  }> {
    const completed = tasks.filter(t => t.status === 'completed');
    const failed = tasks.filter(t => t.status === 'failed');

    const patternPrompt = `
Analyze these task execution patterns:

Completed Tasks (${completed.length}):
${completed.map(t => `- ${t.description} (${t.tool})`).join('\n')}

Failed Tasks (${failed.length}):
${failed.map(t => `- ${t.description} (${t.tool}): ${t.error}`).join('\n')}

Identify:
1. Common issues that led to failures
2. Patterns in successful tasks
3. Recommendations to improve success rate

Respond in JSON:
{
  "commonIssues": ["issue 1", "issue 2", ...],
  "successPatterns": ["pattern 1", "pattern 2", ...],
  "recommendations": ["rec 1", "rec 2", ...]
}
`;

    try {
      const response = await this.callLLM(patternPrompt);
      const parsed = JSON.parse(this.extractJSON(response));

      return {
        commonIssues: parsed.commonIssues || [],
        successPatterns: parsed.successPatterns || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      return {
        commonIssues: [],
        successPatterns: [],
        recommendations: [],
      };
    }
  }

  /**
   * Evaluate if a plan is likely to succeed
   */
  async evaluatePlan(
    tasks: Task[],
    context: { availableTools: string[] }
  ): Promise<{
    score: number; // 0-1
    concerns: string[];
    improvements: string[];
  }> {
    const evaluationPrompt = `
Evaluate the quality of this task plan.

Tasks:
${tasks.map((t, i) => `${i + 1}. ${t.description} (Tool: ${t.tool}, Deps: ${t.dependencies?.join(', ') || 'none'})`).join('\n')}

Available Tools: ${context.availableTools.join(', ')}

Rate the plan (0.0 to 1.0) based on:
1. Are all tools available?
2. Are dependencies correct?
3. Are tasks well-defined?
4. Is the plan efficient?
5. Are there any obvious issues?

Respond in JSON:
{
  "score": 0.0-1.0,
  "concerns": ["concern 1", ...],
  "improvements": ["improvement 1", ...]
}
`;

    try {
      const response = await this.callLLM(evaluationPrompt);
      const parsed = JSON.parse(this.extractJSON(response));

      return {
        score: parsed.score || 0.5,
        concerns: parsed.concerns || [],
        improvements: parsed.improvements || [],
      };
    } catch (error) {
      return {
        score: 0.5,
        concerns: ['Failed to evaluate plan'],
        improvements: [],
      };
    }
  }

  /**
   * Parse reflection response
   */
  private parseReflectionResponse(response: string): ReflectionResult {
    try {
      const parsed = JSON.parse(this.extractJSON(response));

      return {
        success: parsed.success === true,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        shouldRetry: parsed.shouldRetry === true,
        alternativeApproach: parsed.alternativeApproach || undefined,
      };
    } catch (error) {
      console.error('Failed to parse reflection response:', error);
      throw error;
    }
  }

  /**
   * Create fallback reflection based on task status
   */
  private createFallbackReflection(task: Task): ReflectionResult {
    if (task.status === 'completed') {
      return {
        success: true,
        confidence: 0.8,
        issues: [],
        suggestions: [],
        shouldRetry: false,
      };
    } else if (task.status === 'failed') {
      return {
        success: false,
        confidence: 0,
        issues: [task.error || 'Task failed'],
        suggestions: ['Try a different approach', 'Check tool arguments'],
        shouldRetry: true,
      };
    } else {
      return {
        success: false,
        confidence: 0.5,
        issues: ['Task did not complete'],
        suggestions: [],
        shouldRetry: false,
      };
    }
  }

  /**
   * Extract JSON from response (handles markdown code blocks)
   */
  private extractJSON(response: string): string {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return jsonMatch[0];
  }

  /**
   * Serialize result for display
   */
  private serializeResult(result: any): string {
    if (typeof result === 'string') {
      return result.slice(0, 500); // Truncate long strings
    }
    try {
      const str = JSON.stringify(result, null, 2);
      return str.length > 500 ? str.slice(0, 500) + '...' : str;
    } catch {
      return String(result);
    }
  }

  /**
   * Call LLM
   */
  private async callLLM(prompt: string): Promise<string> {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.provider === 'gemini') {
      return this.callGemini(prompt);
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });

    const response = await client.messages.create({
      model: this.model || 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.chat.completions.create({
      model: this.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async callGemini(prompt: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: this.model || 'gemini-2.0-flash-exp',
    });

    const response = await model.generateContent(prompt);
    return response.response.text();
  }
}
