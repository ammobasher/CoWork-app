/**
 * RLM Executor
 *
 * Manages recursive LLM calls for processing large contexts
 */

import { nanoid } from 'nanoid';
import {
  RLMContext,
  RLMCall,
  RLMTrajectory,
  RLMExecutionResult,
  ProcessingStrategy,
} from './types';
import { DataChunker } from './chunking';

export class RLMExecutor {
  private provider: 'anthropic' | 'openai' | 'gemini';
  private apiKey: string;
  private model?: string;
  private maxRecursionDepth: number;
  private maxExecutionTime: number;
  private trajectory: RLMCall[] = [];
  private startTime: number = 0;

  constructor(config: {
    provider: 'anthropic' | 'openai' | 'gemini';
    apiKey: string;
    model?: string;
    maxRecursionDepth?: number;
    maxExecutionTime?: number;
  }) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxRecursionDepth = config.maxRecursionDepth || 10;
    this.maxExecutionTime = config.maxExecutionTime || 300000; // 5 minutes
  }

  /**
   * Execute an RLM task with recursive processing
   */
  async execute(
    task: string,
    context: Record<string, any>,
    strategy: ProcessingStrategy = 'map-reduce'
  ): Promise<RLMExecutionResult> {
    this.startTime = Date.now();
    this.trajectory = [];

    const rlmContext: RLMContext = {
      variables: context,
      maxRecursionDepth: this.maxRecursionDepth,
      maxExecutionTime: this.maxExecutionTime,
      provider: this.provider,
      apiKey: this.apiKey,
      model: this.model,
      currentDepth: 0,
      callStack: [],
      subResults: new Map(),
    };

    try {
      const result = await this.processWithStrategy(task, rlmContext, strategy);

      const executionTime = Date.now() - this.startTime;

      return {
        success: true,
        result,
        trajectory: this.buildTrajectory(),
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        trajectory: this.buildTrajectory(),
        executionTime: Date.now() - this.startTime,
      };
    }
  }

  /**
   * Process task using the specified strategy
   */
  private async processWithStrategy(
    task: string,
    context: RLMContext,
    strategy: ProcessingStrategy
  ): Promise<any> {
    switch (strategy) {
      case 'map-reduce':
        return this.mapReduceStrategy(task, context);

      case 'recursive-decomposition':
        return this.recursiveDecompositionStrategy(task, context);

      case 'sequential-processing':
        return this.sequentialProcessingStrategy(task, context);

      case 'tree-traversal':
        return this.treeTraversalStrategy(task, context);

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * Map-Reduce Strategy: Split data, process chunks, aggregate results
   */
  private async mapReduceStrategy(task: string, context: RLMContext): Promise<any> {
    // Find the largest variable in context to chunk
    const largestVar = this.findLargestVariable(context.variables);

    if (!largestVar) {
      // No large data to chunk, process directly
      return this.makeRLMCall(task, context, 'direct-call');
    }

    const [varName, varData] = largestVar;

    // Chunk the data
    const chunks = this.chunkData(varData);

    if (chunks.length === 1) {
      // Data is small enough, process directly
      return this.makeRLMCall(task, context, 'direct-call');
    }

    // Map: Process each chunk recursively
    const mapPromises = chunks.map(async (chunk, idx) => {
      const chunkContext = {
        ...context,
        variables: {
          ...context.variables,
          [varName]: chunk,
          chunk_index: idx,
          total_chunks: chunks.length,
        },
        currentDepth: context.currentDepth + 1,
        callStack: [...context.callStack, `map-${idx}`],
      };

      const mapTask = `Process this chunk of data for the task: ${task}\n\nChunk ${idx + 1}/${chunks.length}`;
      return this.makeRLMCall(mapTask, chunkContext, `map-${idx}`);
    });

    const mapResults = await Promise.all(mapPromises);

    // Reduce: Aggregate results
    const reduceContext = {
      ...context,
      variables: {
        ...context.variables,
        chunk_results: mapResults,
      },
      currentDepth: context.currentDepth + 1,
      callStack: [...context.callStack, 'reduce'],
    };

    const reduceTask = `Aggregate these chunk results for the task: ${task}\n\nYou have ${mapResults.length} chunk results to combine.`;
    return this.makeRLMCall(reduceTask, reduceContext, 'reduce');
  }

  /**
   * Recursive Decomposition: Break task into subtasks
   */
  private async recursiveDecompositionStrategy(
    task: string,
    context: RLMContext
  ): Promise<any> {
    // First, ask LLM to decompose the task
    const decompositionPrompt = `
Given this task: ${task}

Available context variables: ${Object.keys(context.variables).join(', ')}

Break this task into 2-5 independent subtasks that can be solved separately and then combined.
Respond with JSON array: [{ "subtask": "description", "needs": ["var1", "var2"] }]
`;

    const decomposition = await this.makeRLMCall(
      decompositionPrompt,
      context,
      'decompose'
    );

    // Parse subtasks
    let subtasks: Array<{ subtask: string; needs: string[] }>;
    try {
      subtasks = JSON.parse(decomposition);
    } catch {
      // If decomposition fails, fall back to direct processing
      return this.makeRLMCall(task, context, 'direct-call');
    }

    // Process subtasks recursively
    const subtaskPromises = subtasks.map(async (st, idx) => {
      const subtaskContext = {
        ...context,
        variables: this.filterVariables(context.variables, st.needs),
        currentDepth: context.currentDepth + 1,
        callStack: [...context.callStack, `subtask-${idx}`],
      };

      return this.makeRLMCall(st.subtask, subtaskContext, `subtask-${idx}`);
    });

    const subtaskResults = await Promise.all(subtaskPromises);

    // Combine subtask results
    const combineContext = {
      ...context,
      variables: {
        ...context.variables,
        subtask_results: subtaskResults,
      },
      currentDepth: context.currentDepth + 1,
      callStack: [...context.callStack, 'combine'],
    };

    const combineTask = `Combine these subtask results to complete: ${task}`;
    return this.makeRLMCall(combineTask, combineContext, 'combine');
  }

  /**
   * Sequential Processing: Process items in sequence
   */
  private async sequentialProcessingStrategy(
    task: string,
    context: RLMContext
  ): Promise<any> {
    const largestVar = this.findLargestVariable(context.variables);

    if (!largestVar) {
      return this.makeRLMCall(task, context, 'direct-call');
    }

    const [varName, varData] = largestVar;
    const items = Array.isArray(varData) ? varData : this.chunkData(varData);

    let accumulatedResult: any = null;

    for (let i = 0; i < items.length; i++) {
      const itemContext = {
        ...context,
        variables: {
          ...context.variables,
          [varName]: items[i],
          previous_result: accumulatedResult,
          item_index: i,
          total_items: items.length,
        },
        currentDepth: context.currentDepth + 1,
        callStack: [...context.callStack, `seq-${i}`],
      };

      const itemTask = `${task}\n\nProcessing item ${i + 1}/${items.length}${accumulatedResult ? '. Previous result available.' : ''}`;
      accumulatedResult = await this.makeRLMCall(itemTask, itemContext, `seq-${i}`);
    }

    return accumulatedResult;
  }

  /**
   * Tree Traversal: Navigate hierarchical structures
   */
  private async treeTraversalStrategy(task: string, context: RLMContext): Promise<any> {
    // Simplified tree traversal - can be extended
    return this.makeRLMCall(task, context, 'tree-traversal');
  }

  /**
   * Make a single RLM call to the LLM
   */
  private async makeRLMCall(
    prompt: string,
    context: RLMContext,
    callId: string
  ): Promise<any> {
    // Check depth and time limits
    if (context.currentDepth >= this.maxRecursionDepth) {
      throw new Error(`Max recursion depth (${this.maxRecursionDepth}) exceeded`);
    }

    if (Date.now() - this.startTime >= this.maxExecutionTime) {
      throw new Error(`Max execution time (${this.maxExecutionTime}ms) exceeded`);
    }

    const call: RLMCall = {
      id: nanoid(),
      prompt,
      context: context.variables,
      depth: context.currentDepth,
      parentId: context.callStack[context.callStack.length - 1],
      status: 'running',
      startTime: Date.now(),
    };

    this.trajectory.push(call);

    try {
      // Build the actual prompt with context
      const fullPrompt = this.buildPromptWithContext(prompt, context.variables);

      // Call the appropriate provider
      const result = await this.callProvider(fullPrompt, context);

      call.status = 'completed';
      call.result = result;
      call.endTime = Date.now();

      return result;
    } catch (error) {
      call.status = 'failed';
      call.error = error instanceof Error ? error.message : 'Unknown error';
      call.endTime = Date.now();
      throw error;
    }
  }

  /**
   * Build prompt with context variables
   */
  private buildPromptWithContext(
    prompt: string,
    variables: Record<string, any>
  ): string {
    let fullPrompt = prompt + '\n\n';

    // Add context variables
    fullPrompt += '# Available Context:\n\n';

    for (const [key, value] of Object.entries(variables)) {
      const valueStr = this.serializeValue(value);
      if (valueStr.length < 5000) {
        fullPrompt += `## ${key}:\n${valueStr}\n\n`;
      } else {
        fullPrompt += `## ${key}:\n${valueStr.slice(0, 5000)}... (truncated, ${valueStr.length} total chars)\n\n`;
      }
    }

    return fullPrompt;
  }

  /**
   * Call the provider's API
   */
  private async callProvider(prompt: string, context: RLMContext): Promise<string> {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt, context);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(prompt, context);
    } else if (this.provider === 'gemini') {
      return this.callGemini(prompt, context);
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, context: RLMContext): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: context.apiKey });

    const response = await client.messages.create({
      model: context.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, context: RLMContext): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: context.apiKey });

    const response = await client.chat.completions.create({
      model: context.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string, context: RLMContext): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(context.apiKey);
    const model = client.getGenerativeModel({
      model: context.model || 'gemini-2.0-flash-exp',
    });

    const response = await model.generateContent(prompt);
    return response.response.text();
  }

  /**
   * Helper: Find largest variable in context
   */
  private findLargestVariable(
    variables: Record<string, any>
  ): [string, any] | null {
    let largest: [string, any] | null = null;
    let largestSize = 0;

    for (const [key, value] of Object.entries(variables)) {
      const size = this.getSize(value);
      if (size > largestSize) {
        largestSize = size;
        largest = [key, value];
      }
    }

    return largestSize > 1000 ? largest : null; // Only return if > 1KB
  }

  /**
   * Helper: Get size of a value
   */
  private getSize(value: any): number {
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length * 100; // Rough estimate
    return JSON.stringify(value).length;
  }

  /**
   * Helper: Chunk data
   */
  private chunkData(data: any): any[] {
    if (typeof data === 'string') {
      return DataChunker.chunk(data, { method: 'semantic', chunkSize: 2000 });
    }
    if (Array.isArray(data)) {
      return DataChunker.chunk(data, { method: 'fixed-size', chunkSize: 10 });
    }
    return [data];
  }

  /**
   * Helper: Filter variables by needs
   */
  private filterVariables(
    variables: Record<string, any>,
    needs: string[]
  ): Record<string, any> {
    const filtered: Record<string, any> = {};
    for (const key of needs) {
      if (key in variables) {
        filtered[key] = variables[key];
      }
    }
    return filtered;
  }

  /**
   * Helper: Serialize value for display
   */
  private serializeValue(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  }

  /**
   * Build trajectory for debugging
   */
  private buildTrajectory(): RLMTrajectory {
    const rootCall = this.trajectory[0];
    const maxDepth = Math.max(...this.trajectory.map((c) => c.depth));

    return {
      id: nanoid(),
      rootCall,
      allCalls: this.trajectory,
      totalCalls: this.trajectory.length,
      maxDepth,
      totalTokens: 0, // TODO: Track tokens
      executionTime: Date.now() - this.startTime,
    };
  }
}
