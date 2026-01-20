/**
 * Agent Planner
 *
 * Decomposes complex user requests into executable task plans
 */

import { nanoid } from 'nanoid';
import { Task, TaskPlan, PlanningContext, PlanStrategy } from './types';
import { validateTaskPlan, extractJSON, safeJSONParse } from '@/lib/utils/validation';

export class AgentPlanner {
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
   * Plan a task by breaking it down into subtasks
   */
  async planTask(userRequest: string, context: PlanningContext): Promise<TaskPlan> {
    const planningPrompt = this.buildPlanningPrompt(userRequest, context);

    try {
      const response = await this.callLLM(planningPrompt);
      const tasks = this.parsePlanResponse(response, context.availableTools);

      const strategy = this.determinePlanStrategy(tasks);

      const plan: TaskPlan = {
        id: nanoid(),
        originalRequest: userRequest,
        tasks,
        strategy,
        createdAt: Date.now(),
        status: 'planning',
        completedTasks: 0,
        totalTasks: tasks.length,
      };

      return plan;
    } catch (error) {
      // Fallback: create a simple single-task plan
      return this.createFallbackPlan(userRequest);
    }
  }

  /**
   * Build the planning prompt
   */
  private buildPlanningPrompt(request: string, context: PlanningContext): string {
    return `You are an AI task planner. Break down the following user request into concrete, executable subtasks.

User Request: ${request}

Available Tools:
${context.availableTools.map(tool => `- ${tool}`).join('\n')}

Conversation Context:
${context.conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content.slice(0, 200)}`).join('\n')}

Requirements:
1. Each task should use ONE tool
2. Tasks should be atomic and specific
3. Specify dependencies between tasks (which tasks must complete first)
4. Keep it simple - prefer fewer tasks over many small ones
5. Consider parallel execution opportunities

Output Format (JSON):
{
  "tasks": [
    {
      "description": "Read the user configuration file",
      "tool": "read_file",
      "args": { "path": "config.json" },
      "dependencies": []
    },
    {
      "description": "Update the theme setting",
      "tool": "write_file",
      "args": { "path": "config.json", "content": "..." },
      "dependencies": ["task-0"]
    }
  ],
  "reasoning": "Brief explanation of the plan"
}

Respond ONLY with valid JSON.`;
  }

  /**
   * Parse the LLM response into tasks
   */
  private parsePlanResponse(response: string, availableTools: string[]): Task[] {
    try {
      // Extract and validate JSON from response
      const jsonStr = extractJSON(response);
      if (!jsonStr) {
        throw new Error('No JSON found in planning response');
      }

      const planData = safeJSONParse(jsonStr, validateTaskPlan);
      if (!planData || !planData.tasks) {
        throw new Error('Invalid task plan structure');
      }

      // Convert to Task objects
      return planData.tasks.map((t, idx) => {
        const task: Task = {
          id: `task-${idx}`,
          description: t.description || 'Unnamed task',
          status: 'pending',
          tool: t.tool,
          args: t.args || {},
          dependencies: t.dependencies || [],
        };

        // Validate tool exists
        if (task.tool && !availableTools.includes(task.tool)) {
          console.warn(`Unknown tool in plan: ${task.tool}`);
        }

        return task;
      });
    } catch (error) {
      console.error('Failed to parse plan response:', error);
      throw error;
    }
  }

  /**
   * Determine the execution strategy based on task dependencies
   */
  private determinePlanStrategy(tasks: Task[]): PlanStrategy {
    // Check if any tasks have dependencies
    const hasDependencies = tasks.some(t => t.dependencies && t.dependencies.length > 0);

    if (!hasDependencies && tasks.length > 1) {
      return 'parallel'; // All independent, can run in parallel
    }

    if (hasDependencies && tasks.length > 3) {
      return 'mixed'; // Mix of sequential and parallel
    }

    return 'sequential'; // Default to sequential
  }

  /**
   * Create a fallback plan when planning fails
   */
  private createFallbackPlan(userRequest: string): TaskPlan {
    return {
      id: nanoid(),
      originalRequest: userRequest,
      tasks: [
        {
          id: 'task-0',
          description: userRequest,
          status: 'pending',
          // No tool specified - will use default LLM response
        },
      ],
      strategy: 'sequential',
      createdAt: Date.now(),
      status: 'planning',
      completedTasks: 0,
      totalTasks: 1,
    };
  }

  /**
   * Call LLM for planning
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
      model: this.model || 'claude-3-5-haiku-20241022', // Use Haiku for planning (faster/cheaper)
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
      model: this.model || 'gpt-4o-mini', // Use mini for planning
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

  /**
   * Replan based on failures or new information
   */
  async replan(
    originalPlan: TaskPlan,
    failedTask: Task,
    error: string
  ): Promise<Task[]> {
    const replanPrompt = `
The following task failed:
Task: ${failedTask.description}
Tool: ${failedTask.tool}
Error: ${error}

Original request: ${originalPlan.originalRequest}

Suggest alternative tasks to accomplish the goal. Consider:
1. Using different tools
2. Breaking the task into smaller steps
3. Working around the error

Output Format (JSON):
{
  "tasks": [...],
  "reasoning": "..."
}
`;

    try {
      const response = await this.callLLM(replanPrompt);
      const tasks = this.parsePlanResponse(response, []); // Tools will be validated later
      return tasks;
    } catch {
      return []; // Return empty if replanning fails
    }
  }

  /**
   * Optimize a plan for better execution
   */
  optimizePlan(plan: TaskPlan): TaskPlan {
    // Identify tasks that can run in parallel
    const optimized = { ...plan };

    // Sort tasks by dependencies (topological sort)
    const sorted = this.topologicalSort(plan.tasks);
    optimized.tasks = sorted;

    // Update strategy
    optimized.strategy = this.determinePlanStrategy(sorted);

    return optimized;
  }

  /**
   * Topological sort for task dependencies
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: Task): void => {
      if (visited.has(task.id)) return;
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected: ${task.id}`);
      }

      visiting.add(task.id);

      // Visit dependencies first
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depTask = tasks.find(t => t.id === depId);
          if (depTask) {
            visit(depTask);
          }
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return sorted;
  }
}
