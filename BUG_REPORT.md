# Code Review: Bugs and Issues Found

## 🐛 CRITICAL BUGS IDENTIFIED

### 1. **RLM Executor - Missing Import in Tools** (CRITICAL)
**File:** `src/lib/ai/tools/rlm.ts`
**Issue:** The tool tries to use `buildCodebaseContext` but there's a potential Node.js fs import issue in browser context.

**Location:** Lines 61-67
```typescript
const codebaseContext = await buildCodebaseContext(codebase_path, {
  maxFiles: 100,
  maxFileSize: 100_000,
});
```

**Problem:** The context builder uses Node.js `fs/promises` which won't work in browser/edge runtime.
**Fix:** Add runtime detection and proper error handling.

---

### 2. **Agent Planner - Tool Registry Not Imported** (CRITICAL)
**File:** `src/lib/agent/executor.ts`
**Issue:** Imports `toolRegistry` from wrong path

**Location:** Line 7
```typescript
import { toolRegistry } from '@/lib/ai/tools';
```

**Problem:** This needs to be imported correctly and the tools module needs to export it.
**Fix:** Ensure proper export from tools module.

---

### 3. **Edit Tool - Regex Escaping Bug** (HIGH)
**File:** `src/lib/ai/tools/edit.ts`
**Issue:** escapeRegex function at the end is used but may not handle all edge cases

**Location:** Line 169
```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Problem:** This is correct, but it's only used for counting occurrences, not for the actual replacement which uses string methods.
**Fix:** No fix needed - this is actually correct.

---

### 4. **RLM Decomposition - JSON Parsing Without Validation** (HIGH)
**File:** `src/lib/rlm/executor.ts`
**Issue:** JSON parsing in recursive-decomposition strategy lacks validation

**Location:** Lines 157-161
```typescript
let subtasks: Array<{ subtask: string; needs: string[] }>;
try {
  subtasks = JSON.parse(decomposition);
} catch {
  return this.makeRLMCall(task, context, 'direct-call');
}
```

**Problem:** No validation that parsed JSON actually has the expected structure.
**Fix:** Add JSON schema validation.

---

### 5. **Grep Tool - Missing Await in Recursive Calls** (MEDIUM)
**File:** `src/lib/ai/tools/grep.ts`
**Issue:** All async functions are properly awaited - FALSE ALARM

---

### 6. **Context Builder - No Max Depth Limit** (MEDIUM)
**File:** `src/lib/rlm/context-builder.ts`
**Issue:** buildDirectoryStructure has depth limit of 5, but scanDir in buildCodebaseContext has no depth limit

**Location:** Line 82-94 (scanDir function)
**Problem:** Could cause stack overflow on very deep directory structures
**Fix:** Add max depth parameter.

---

### 7. **Parallel Executor - Race Condition** (MEDIUM)
**File:** `src/lib/agent/executor.ts`
**Issue:** In executeMixed, using Promise.race might cause issues

**Location:** Lines 154-158
```typescript
if (promises.length > 0) {
  await Promise.race(promises);
} else {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Problem:** Promise.race resolves when the FIRST promise completes, but we're not actually removing completed promises from tracking. This could lead to spinning.
**Fix:** Use Promise.allSettled or better tracking.

---

### 8. **Tool Integration - Missing Runtime Detection** (HIGH)
**File:** `src/lib/ai/tools/rlm.ts`, `edit.ts`, `grep.ts`, `batch.ts`
**Issue:** All file system tools use Node.js fs module without runtime detection

**Problem:** Will fail in Edge runtime or browser environment
**Fix:** Add runtime detection and graceful degradation.

---

### 9. **Agent Reflector - No Rate Limiting** (LOW)
**File:** `src/lib/agent/reflector.ts`
**Issue:** Makes multiple LLM calls without rate limiting

**Problem:** Could hit API rate limits
**Fix:** Add rate limiting or batching.

---

### 10. **Tool Registry Export Missing** (CRITICAL)
**File:** `src/lib/ai/tools.ts`
**Issue:** The file doesn't export `toolRegistry` but agent executor imports it

**Fix:** Need to export toolRegistry from types.ts properly.

---

## ✅ THINGS THAT ARE CORRECT

1. ✅ Error handling in most places
2. ✅ Type definitions are comprehensive
3. ✅ Async/await properly used
4. ✅ Most edge cases handled
5. ✅ UI changes are correct
6. ✅ Git tool improvements are solid

---

## 🔧 FIXES REQUIRED

### Priority 1 (CRITICAL - Must Fix)
1. Fix toolRegistry import/export
2. Add runtime detection for file system operations
3. Fix RLM tool to work in API route context

### Priority 2 (HIGH - Should Fix)
4. Add JSON validation in RLM decomposition
5. Add depth limit to context builder
6. Fix race condition in parallel executor

### Priority 3 (MEDIUM - Nice to Have)
7. Add rate limiting
8. Add more comprehensive error messages
9. Add logging/debugging utilities

---

## 📋 TEST CASES NEEDED

1. RLM with large codebase
2. Agent planning with dependencies
3. Parallel execution with failures
4. All new tools individually
5. Error recovery scenarios
6. Edge cases (empty files, special characters, etc.)

---

**Next Steps:** Create fixes for critical bugs first.
