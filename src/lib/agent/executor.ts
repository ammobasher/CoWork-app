/**
 * Parallel Task Executor
 *
 * Executes tasks with dependency management and parallel execution
 */

import { toolRegistry } from '@/lib/ai/tools';
import { Task, TaskPlan, ExecutionContext, TaskStatus } from './types';

export class ParallelExecutor {
  private context: ExecutionContext;
  private maxParallelTasks: number;
  private maxRetries: number;

  constructor(context: ExecutionContext, config?: {
    maxParallelTasks?: number;
    maxRetries?: number;
  }) {
    this.context = context;
    this.maxParallelTasks = config?.maxParallelTasks || 5;
    this.maxRetries = config?.maxRetries || 2;
  }

  /**
   * Execute a task plan
   */
  async executePlan(plan: TaskPlan): Promise<{
    success: boolean;
    results: Map<string, any>;
    failedTasks: Task[];
  }> {
    const results = new Map<string, any>();
    const failedTasks: Task[] = [];

    plan.status = 'executing';

    try {
      if (plan.strategy === 'sequential') {
        await this.executeSequential(plan.tasks, results, failedTasks);
      } else if (plan.strategy === 'parallel') {
        await this.executeParallel(plan.tasks, results, failedTasks);
      } else {
        await this.executeMixed(plan.tasks, results, failedTasks);
      }

      plan.status = failedTasks.length === 0 ? 'completed' : 'failed';
      plan.completedTasks = results.size;

      return {
        success: failedTasks.length === 0,
        results,
        failedTasks,
      };
    } catch (error) {
      plan.status = 'failed';
      return {
        success: false,
        results,
        failedTasks,
      };
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(
    tasks: Task[],
    results: Map<string, any>,
    failedTasks: Task[]
  ): Promise<void> {
    for (const task of tasks) {
      try {
        const result = await this.executeTask(task, results);
        results.set(task.id, result);
        task.status = 'completed';
        task.result = result;

        this.context.onTaskComplete?.(task);
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        failedTasks.push(task);

        this.context.onTaskFailed?.(task, error as Error);

        // Stop execution on failure in sequential mode
        break;
      }
    }
  }

  /**
   * Execute tasks in parallel (all independent)
   */
  private async executeParallel(
    tasks: Task[],
    results: Map<string, any>,
    failedTasks: Task[]
  ): Promise<void> {
    const batches = this.createBatches(tasks, this.maxParallelTasks);

    for (const batch of batches) {
      const promises = batch.map(async (task) => {
        try {
          const result = await this.executeTask(task, results);
          results.set(task.id, result);
          task.status = 'completed';
          task.result = result;

          this.context.onTaskComplete?.(task);
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown error';
          failedTasks.push(task);

          this.context.onTaskFailed?.(task, error as Error);
        }
      });

      await Promise.allSettled(promises);
    }
  }

  /**
   * Execute tasks with mixed sequential and parallel execution
   */
  private async executeMixed(
    tasks: Task[],
    results: Map<string, any>,
    failedTasks: Task[]
  ): Promise<void> {
    const pending = new Set(tasks.map(t => t.id));
    const inProgress = new Set<string>();

    while (pending.size > 0 || inProgress.size > 0) {
      // Find tasks that can run now (all dependencies met)
      const ready = tasks.filter(task =>
        pending.has(task.id) &&
        this.areDependenciesMet(task, results) &&
        inProgress.size < this.maxParallelTasks
      );

      if (ready.length === 0 && inProgress.size === 0) {
        // Deadlock or all remaining tasks have unmet dependencies
        const remainingTasks = tasks.filter(t => pending.has(t.id));
        if (remainingTasks.length > 0) {
          console.error('Deadlock or unmet dependencies:', remainingTasks);
          remainingTasks.forEach(t => {
            t.status = 'skipped';
            t.error = 'Unmet dependencies or deadlock';
            failedTasks.push(t);
            pending.delete(t.id);
          });
        }
        break;
      }

      // Execute ready tasks in parallel
      const promises = ready.map(async (task) => {
        pending.delete(task.id);
        inProgress.add(task.id);

        try {
          const result = await this.executeTask(task, results);
          results.set(task.id, result);
          task.status = 'completed';
          task.result = result;

          this.context.onTaskComplete?.(task);
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown error';
          failedTasks.push(task);

          this.context.onTaskFailed?.(task, error as Error);
        } finally {
          inProgress.delete(task.id);
        }
      });

      if (promises.length > 0) {
        await Promise.race(promises); // Wait for at least one to complete
      } else {
        // No tasks ready, wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task, completedResults: Map<string, any>): Promise<any> {
    task.status = 'in_progress';
    task.startTime = Date.now();
    task.retries = task.retries || 0;

    this.context.onProgress?.(task);

    try {
      if (!task.tool) {
        throw new Error('Task has no tool specified');
      }

      // Resolve dependency results in args
      const resolvedArgs = this.resolveDependencies(task, completedResults);

      // Execute the tool
      const result = await toolRegistry.execute(
        task.tool,
        resolvedArgs,
        {
          apiKeys: this.context.apiKeys,
          workspaceRoot: this.context.workspaceRoot,
        }
      );

      task.endTime = Date.now();
      return result;
    } catch (error) {
      // Retry logic
      if (task.retries! < this.maxRetries) {
        task.retries!++;
        console.log(`Retrying task ${task.id} (attempt ${task.retries + 1})`);
        return this.executeTask(task, completedResults);
      }

      task.endTime = Date.now();
      throw error;
    }
  }

  /**
   * Check if all dependencies are met
   */
  private areDependenciesMet(task: Task, results: Map<string, any>): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => results.has(depId));
  }

  /**
   * Resolve dependency results into task args
   */
  private resolveDependencies(
    task: Task,
    results: Map<string, any>
  ): Record<string, any> {
    const args = { ...task.args };

    if (!task.dependencies) return args;

    // Inject dependency results
    task.dependencies.forEach(depId => {
      const result = results.get(depId);
      if (result !== undefined) {
        // Make dependency results available
        args[`__dep_${depId}`] = result;
      }
    });

    // Replace placeholder references like "${task-0.result}"
    const argsStr = JSON.stringify(args);
    const resolvedStr = argsStr.replace(
      /\$\{([^}]+)\}/g,
      (match, ref) => {
        const [taskId, ...path] = ref.split('.');
        const result = results.get(taskId);
        if (result === undefined) return match;

        // Navigate path if specified
        let value = result;
        for (const key of path) {
          value = value?.[key];
        }

        return typeof value === 'string' ? value : JSON.stringify(value);
      }
    );

    return JSON.parse(resolvedStr);
  }

  /**
   * Create batches for parallel execution
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Execute a single task independently
   */
  async executeOne(task: Task): Promise<any> {
    const results = new Map<string, any>();
    return this.executeTask(task, results);
  }
}
