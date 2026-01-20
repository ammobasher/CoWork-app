# Critical Fixes Applied

## ✅ Fix #1: Runtime Detection Utility

**Created:** `src/lib/utils/runtime.ts`

**Purpose:** Detect runtime environment (Node.js, Edge, Browser) to prevent file system operations in wrong contexts.

**Functions:**
- `detectRuntime()` - Detect current environment
- `hasFileSystemAccess()` - Check if fs operations are available
- `isServerSide()` - Check if running server-side
- `isBrowser()` - Check if running in browser

**Usage:**
```typescript
import { hasFileSystemAccess } from '@/lib/utils/runtime';

if (!hasFileSystemAccess()) {
  return { success: false, error: 'File system operations not available in this runtime' };
}
```

---

## ✅ Fix #2: JSON Validation Utilities

**Created:** `src/lib/utils/validation.ts`

**Purpose:** Type-safe JSON validation to prevent runtime errors from malformed LLM responses.

**Functions:**
- `validateSubtasks()` - Validate RLM subtask structure
- `validateTaskPlan()` - Validate agent task plan structure
- `validateReflectionResult()` - Validate reflection result structure
- `safeJSONParse()` - Safe JSON parsing with validation
- `extractJSON()` - Extract JSON from markdown code blocks

**Usage:**
```typescript
import { safeJSONParse, validateSubtasks, extractJSON } from '@/lib/utils/validation';

const jsonStr = extractJSON(llmResponse);
if (!jsonStr) {
  return fallbackBehavior();
}

const subtasks = safeJSONParse(jsonStr, validateSubtasks);
if (!subtasks) {
  return fallbackBehavior();
}
```

---

## 🔄 Fix #3: RLM Executor - JSON Validation (NEEDS APPLY)

**File:** `src/lib/rlm/executor.ts`
**Lines:** 191-197

**Current Code:**
```typescript
let subtasks: Array<{ subtask: string; needs: string[] }>;
try {
  subtasks = JSON.parse(decomposition);
} catch {
  return this.makeRLMCall(task, context, 'direct-call');
}
```

**Fixed Code:**
```typescript
import { validateSubtasks, extractJSON, safeJSONParse } from '@/lib/utils/validation';

// In recursiveDecompositionStrategy method:
const jsonStr = extractJSON(decomposition);
if (!jsonStr) {
  console.warn('No JSON found in decomposition response, falling back to direct processing');
  return this.makeRLMCall(task, context, 'direct-call');
}

const subtasks = safeJSONParse(jsonStr, validateSubtasks);
if (!subtasks) {
  console.warn('Invalid subtask structure, falling back to direct processing');
  return this.makeRLMCall(task, context, 'direct-call');
}
```

**Status:** ⏳ Needs manual application

---

## 🔄 Fix #4: Agent Planner - JSON Validation (NEEDS APPLY)

**File:** `src/lib/agent/planner.ts`
**Lines:** 69-82

**Current Code:**
```typescript
try {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  // ... validation ...
}
```

**Fixed Code:**
```typescript
import { validateTaskPlan, extractJSON, safeJSONParse } from '@/lib/utils/validation';

const jsonStr = extractJSON(response);
if (!jsonStr) {
  throw new Error('No JSON found in planning response');
}

const planData = safeJSONParse(jsonStr, validateTaskPlan);
if (!planData) {
  throw new Error('Invalid task plan structure');
}

// Now safely use planData.tasks
```

**Status:** ⏳ Needs manual application

---

## 🔄 Fix #5: Agent Reflector - JSON Validation (NEEDS APPLY)

**File:** `src/lib/agent/reflector.ts`
**Lines:** 94-104, 154-165, etc.

**Current Code:**
```typescript
const parsed = JSON.parse(this.extractJSON(response));
```

**Fixed Code:**
```typescript
import { validateReflectionResult, extractJSON as extractJSONUtil, safeJSONParse } from '@/lib/utils/validation';

const jsonStr = extractJSONUtil(response);
if (!jsonStr) {
  throw new Error('No JSON in reflection response');
}

const reflection = safeJSONParse(jsonStr, validateReflectionResult);
if (!reflection) {
  throw new Error('Invalid reflection structure');
}
```

**Status:** ⏳ Needs manual application

---

## 🔄 Fix #6: Context Builder - Depth Limit (NEEDS APPLY)

**File:** `src/lib/rlm/context-builder.ts`
**Lines:** 82-94

**Current Code:**
```typescript
async function scanDir(dir: string): Promise<void> {
  if (fileCount >= maxFiles) return;
  // ... no depth tracking ...
}
```

**Fixed Code:**
```typescript
async function scanDir(dir: string, currentDepth: number = 0): Promise<void> {
  if (fileCount >= maxFiles) return;
  if (currentDepth > 10) return; // Prevent infinite recursion

  // ... existing code ...

  if (entry.isDirectory()) {
    await scanDir(fullPath, currentDepth + 1); // Pass depth
  }
}

// Initial call
await scanDir(rootPath, 0);
```

**Status:** ⏳ Needs manual application

---

## 🔄 Fix #7: Parallel Executor - Race Condition (NEEDS APPLY)

**File:** `src/lib/agent/executor.ts`
**Lines:** 133-163

**Current Code:**
```typescript
await Promise.race(promises); // Wait for at least one to complete
```

**Problem:** Promise.race waits for first completion, but we don't track which one completed.

**Fixed Code:**
```typescript
// Replace Promise.race with Promise.allSettled
const promises = ready.map(async (task) => {
  // ... existing code ...
});

if (promises.length > 0) {
  // Wait for at least one to finish, but track all
  await Promise.race([
    ...promises,
    // Add timeout to prevent infinite waiting
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Task execution timeout')), 60000)
    )
  ]);
} else {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Better Fix:** Track completed promises properly:
```typescript
const runningPromises = new Map<string, Promise<void>>();

for (const task of ready) {
  const promise = (async () => {
    // ... execute task ...
  })();

  runningPromises.set(task.id, promise);

  promise.finally(() => {
    runningPromises.delete(task.id);
  });
}

// Wait for at least one
if (runningPromises.size > 0) {
  await Promise.race(Array.from(runningPromises.values()));
}
```

**Status:** ⏳ Needs manual application

---

## 🔄 Fix #8: File System Tools - Runtime Detection (NEEDS APPLY)

**Files:**
- `src/lib/ai/tools/edit.ts`
- `src/lib/ai/tools/grep.ts`
- `src/lib/ai/tools/batch.ts`
- `src/lib/rlm/context-builder.ts`

**Add to Each Tool:**
```typescript
import { hasFileSystemAccess } from '@/lib/utils/runtime';

export const editFileTool: Tool = {
  // ... definition ...
  execute: async (args) => {
    // Add runtime check
    if (!hasFileSystemAccess()) {
      return {
        success: false,
        error: 'File system operations are not available in this runtime environment',
        hint: 'This tool requires Node.js runtime. Ensure API routes are running server-side.',
      };
    }

    // ... rest of implementation ...
  },
};
```

**Status:** ⏳ Needs manual application

---

## Summary of Fixes

| Fix # | File | Type | Priority | Status |
|-------|------|------|----------|--------|
| 1 | utils/runtime.ts | NEW | Critical | ✅ Created |
| 2 | utils/validation.ts | NEW | Critical | ✅ Created |
| 3 | rlm/executor.ts | MODIFY | High | ⏳ Pending |
| 4 | agent/planner.ts | MODIFY | High | ⏳ Pending |
| 5 | agent/reflector.ts | MODIFY | High | ⏳ Pending |
| 6 | rlm/context-builder.ts | MODIFY | Medium | ⏳ Pending |
| 7 | agent/executor.ts | MODIFY | Medium | ⏳ Pending |
| 8 | tools/*.ts | MODIFY | High | ⏳ Pending |

---

## Why These Fixes Matter

### Without JSON Validation:
❌ LLM returns malformed JSON → Runtime crash
❌ Missing fields → Type errors
❌ Unexpected structure → Logic errors

### With JSON Validation:
✅ Invalid JSON → Graceful fallback
✅ Type-safe parsing
✅ Better error messages
✅ No runtime crashes

### Without Runtime Detection:
❌ File system calls in Edge/Browser → Crash
❌ Confusing error messages
❌ Silent failures

### With Runtime Detection:
✅ Clear error messages
✅ Graceful degradation
✅ Works across all runtimes

### Without Depth Limiting:
❌ Deeply nested folders → Stack overflow
❌ Symlink loops → Infinite recursion

### With Depth Limiting:
✅ Prevents stack overflow
✅ Handles edge cases
✅ Predictable behavior

---

## Next Steps

1. Apply pending modifications to source files
2. Create test suite to verify fixes
3. Test in different runtime environments
4. Monitor for edge cases

---

**Status:** 2/8 fixes completed, 6 pending application
