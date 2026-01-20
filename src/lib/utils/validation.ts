/**
 * Validation Utilities
 *
 * Type-safe validation helpers
 */

/**
 * Validate that a value is an array
 */
export function isArray(value: unknown): value is any[] {
  return Array.isArray(value);
}

/**
 * Validate that a value is an object
 */
export function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate that a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Validate that a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Validate subtask structure for RLM decomposition
 */
export interface Subtask {
  subtask: string;
  needs: string[];
}

export function validateSubtasks(data: unknown): data is Subtask[] {
  if (!isArray(data)) {
    return false;
  }

  return data.every(item => {
    if (!isObject(item)) return false;
    if (!isString(item.subtask)) return false;
    if (!isArray(item.needs)) return false;
    return item.needs.every((need: unknown) => isString(need));
  });
}

/**
 * Validate task plan structure
 */
export interface TaskDefinition {
  description: string;
  tool?: string;
  args?: Record<string, any>;
  dependencies?: string[];
}

export function validateTaskPlan(data: unknown): data is { tasks: TaskDefinition[]; reasoning?: string } {
  if (!isObject(data)) {
    return false;
  }

  if (!isArray(data.tasks)) {
    return false;
  }

  return data.tasks.every(task => {
    if (!isObject(task)) return false;
    if (!isString(task.description)) return false;

    // tool is optional
    if (task.tool !== undefined && !isString(task.tool)) return false;

    // args is optional
    if (task.args !== undefined && !isObject(task.args)) return false;

    // dependencies is optional
    if (task.dependencies !== undefined) {
      if (!isArray(task.dependencies)) return false;
      if (!task.dependencies.every((dep: unknown) => isString(dep))) return false;
    }

    return true;
  });
}

/**
 * Validate reflection result structure
 */
export interface ReflectionResultData {
  success: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  shouldRetry: boolean;
  alternativeApproach?: any;
}

export function validateReflectionResult(data: unknown): data is ReflectionResultData {
  if (!isObject(data)) {
    return false;
  }

  if (typeof data.success !== 'boolean') return false;
  if (!isNumber(data.confidence) || data.confidence < 0 || data.confidence > 1) return false;
  if (!isArray(data.issues) || !data.issues.every((i: unknown) => isString(i))) return false;
  if (!isArray(data.suggestions) || !data.suggestions.every((s: unknown) => isString(s))) return false;
  if (typeof data.shouldRetry !== 'boolean') return false;

  return true;
}

/**
 * Safe JSON parse with validation
 */
export function safeJSONParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extract JSON from markdown code blocks or raw text
 */
export function extractJSON(text: string): string | null {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1];
  }

  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}
