/**
 * Recursive Language Model (RLM) Types
 *
 * RLM treats large inputs as external variables that can be programmatically
 * examined, decomposed, and recursively processed by the LLM.
 */

export type ProcessingStrategy =
  | "map-reduce"           // Split data, process chunks in parallel, aggregate
  | "recursive-decomposition" // Break task into subtasks recursively
  | "sequential-processing"   // Process items in sequence
  | "tree-traversal";         // Navigate tree-like structures

export interface RLMContext {
  // Data available to the RLM for processing
  variables: Record<string, any>;

  // Configuration
  maxRecursionDepth: number;
  maxExecutionTime: number;

  // Provider information
  provider: 'anthropic' | 'openai' | 'gemini';
  apiKey: string;
  model?: string;

  // Tracking
  currentDepth: number;
  callStack: string[];

  // Results from previous recursive calls
  subResults?: Map<string, any>;
}

export interface RLMCall {
  id: string;
  prompt: string;
  context: Record<string, any>;
  depth: number;
  parentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface RLMTrajectory {
  id: string;
  rootCall: RLMCall;
  allCalls: RLMCall[];
  totalCalls: number;
  maxDepth: number;
  totalTokens: number;
  executionTime: number;
}

export interface ChunkingStrategy {
  method: 'fixed-size' | 'semantic' | 'structural' | 'custom';
  chunkSize?: number;
  overlap?: number;
  separator?: string;
  customChunker?: (data: string) => string[];
}

export interface RLMExecutionResult {
  success: boolean;
  result?: any;
  trajectory?: RLMTrajectory;
  error?: string;
  tokensUsed?: number;
  executionTime?: number;
}
