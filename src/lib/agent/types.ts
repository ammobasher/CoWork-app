/**
 * Agent Types for Autonomous Task Planning and Execution
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  tool?: string;
  args?: Record<string, any>;
  dependencies?: string[]; // IDs of tasks that must complete first
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retries?: number;
  subtasks?: Task[];
  metadata?: {
    priority?: number;
    estimatedDuration?: number;
    tags?: string[];
  };
}

export interface TaskPlan {
  id: string;
  originalRequest: string;
  tasks: Task[];
  strategy: PlanStrategy;
  createdAt: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  completedTasks: number;
  totalTasks: number;
}

export type PlanStrategy =
  | 'sequential'    // Execute tasks one by one
  | 'parallel'      // Execute independent tasks concurrently
  | 'mixed';        // Mix of sequential and parallel

export interface PlanningContext {
  conversationHistory: Array<{ role: string; content: string }>;
  availableTools: string[];
  projectContext?: any;
  constraints?: {
    maxParallelTasks?: number;
    maxTotalTasks?: number;
    timeLimit?: number;
  };
}

export interface ExecutionContext {
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    tavily?: string;
  };
  workspaceRoot?: string;
  maxRetries?: number;
  onProgress?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskFailed?: (task: Task, error: Error) => void;
}

export interface ReflectionResult {
  success: boolean;
  confidence: number; // 0-1
  issues: string[];
  suggestions: string[];
  shouldRetry: boolean;
  alternativeApproach?: Task;
}

export interface AgentState {
  currentPlan?: TaskPlan;
  executionHistory: Task[];
  learnings: string[];
  failures: Array<{
    task: Task;
    error: string;
    reflection: ReflectionResult;
  }>;
}
