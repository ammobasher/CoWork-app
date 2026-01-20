# Comprehensive Test Suite for CoWork Improvements

## Test Categories

1. **Unit Tests** - Test individual functions
2. **Integration Tests** - Test tool integration
3. **Agent Tests** - Test autonomous agent capabilities
4. **RLM Tests** - Test recursive language model functionality
5. **UI Tests** - Test accessibility and contrast
6. **Edge Case Tests** - Test error handling

---

## 1. UNIT TESTS

### 1.1 Runtime Detection Tests

**File:** `src/lib/utils/runtime.ts`

```typescript
// Test detectRuntime()
describe('Runtime Detection', () => {
  test('detects Node.js environment', () => {
    const runtime = detectRuntime();
    expect(runtime).toBe('nodejs');
  });

  test('hasFileSystemAccess returns true in Node.js', () => {
    expect(hasFileSystemAccess()).toBe(true);
  });

  test('isServerSide returns true in Node.js', () => {
    expect(isServerSide()).toBe(true);
  });

  test('isBrowser returns false in Node.js', () => {
    expect(isBrowser()).toBe(false);
  });
});
```

**Manual Test:**
```bash
# In Node.js REPL or test file:
const { detectRuntime, hasFileSystemAccess } = require('./src/lib/utils/runtime.ts');
console.log(detectRuntime()); // Should print 'nodejs'
console.log(hasFileSystemAccess()); // Should print true
```

**Expected:** ✅ All functions return correct values for Node.js environment

---

### 1.2 JSON Validation Tests

**File:** `src/lib/utils/validation.ts`

```typescript
describe('JSON Validation', () => {
  test('validates correct subtask structure', () => {
    const valid = [
      { subtask: "Read file", needs: ["filename"] },
      { subtask: "Process data", needs: ["data", "config"] }
    ];
    expect(validateSubtasks(valid)).toBe(true);
  });

  test('rejects invalid subtask structure', () => {
    const invalid = [
      { subtask: "Read file" }, // Missing 'needs'
      { task: "Process", needs: [] } // Wrong key 'task'
    ];
    expect(validateSubtasks(invalid)).toBe(false);
  });

  test('safeJSONParse returns null for invalid JSON', () => {
    const result = safeJSONParse('{ invalid json }', validateSubtasks);
    expect(result).toBe(null);
  });

  test('extractJSON extracts from markdown code blocks', () => {
    const markdown = '```json\n{"key": "value"}\n```';
    const extracted = extractJSON(markdown);
    expect(extracted).toBe('{"key": "value"}');
  });

  test('extractJSON extracts from plain text', () => {
    const text = 'Here is some JSON: {"key": "value"} and more text';
    const extracted = extractJSON(text);
    expect(extracted).toBe('{"key": "value"}');
  });
});
```

**Manual Test:**
```typescript
// Test valid subtasks
const validSubtasks = [
  { subtask: "Test task", needs: ["var1"] }
];
console.log(validateSubtasks(validSubtasks)); // true

// Test invalid subtasks
const invalidSubtasks = [
  { wrong_key: "Test", needs: [] }
];
console.log(validateSubtasks(invalidSubtasks)); // false

// Test JSON extraction
const markdown = '```json\n{"test": true}\n```';
console.log(extractJSON(markdown)); // '{"test": true}'
```

**Expected:** ✅ All validations work correctly

---

## 2. TOOL INTEGRATION TESTS

### 2.1 Edit Tool Tests

**File:** `src/lib/ai/tools/edit.ts`

```typescript
describe('Edit Tool', () => {
  test('edit_file replaces exact match', async () => {
    // Create test file
    await fs.writeFile('test.txt', 'Hello World');

    const result = await editFileTool.execute({
      path: 'test.txt',
      search: 'World',
      replace: 'Universe'
    });

    expect(result.success).toBe(true);
    expect(result.replacements).toBe(1);

    const content = await fs.readFile('test.txt', 'utf-8');
    expect(content).toBe('Hello Universe');
  });

  test('edit_file returns error for non-existent string', async () => {
    await fs.writeFile('test.txt', 'Hello World');

    const result = await editFileTool.execute({
      path: 'test.txt',
      search: 'NotFound',
      replace: 'Something'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('multi_edit applies multiple edits', async () => {
    await fs.writeFile('test.txt', 'foo bar baz');

    const result = await multiEditTool.execute({
      path: 'test.txt',
      edits: [
        { search: 'foo', replace: 'FOO' },
        { search: 'bar', replace: 'BAR' }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.applied).toBe(2);

    const content = await fs.readFile('test.txt', 'utf-8');
    expect(content).toBe('FOO BAR baz');
  });
});
```

**Manual Test:**
```bash
# Create test file
echo "Hello World" > test.txt

# Test edit_file tool through API or directly
# Should replace "World" with "Universe"

# Verify
cat test.txt # Should show "Hello Universe"

# Clean up
rm test.txt
```

**Expected:** ✅ Edits are applied correctly

---

### 2.2 Grep Tool Tests

```typescript
describe('Grep Tool', () => {
  test('finds pattern in file', async () => {
    await fs.writeFile('test.js', 'function test() { return 42; }');

    const result = await grepTool.execute({
      pattern: 'function',
      path: 'test.js'
    });

    expect(result.success).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].match).toBe('function');
  });

  test('supports regex patterns', async () => {
    await fs.writeFile('test.js', 'const x = 123;\nconst y = 456;');

    const result = await grepTool.execute({
      pattern: 'const\\s+\\w+',
      path: 'test.js'
    });

    expect(result.success).toBe(true);
    expect(result.matches.length).toBe(2);
  });

  test('finds files recursively', async () => {
    await fs.mkdir('testdir', { recursive: true });
    await fs.writeFile('testdir/file1.js', 'test content');
    await fs.writeFile('testdir/file2.js', 'test content');

    const result = await grepTool.execute({
      pattern: 'test',
      path: 'testdir',
      recursive: true
    });

    expect(result.success).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Manual Test:**
```bash
# Create test files
mkdir -p testdir
echo "function test() {}" > testdir/test.js
echo "const x = 42;" > testdir/const.js

# Test grep
# Should find "function" in test.js
# Should find "const" in const.js

# Clean up
rm -rf testdir
```

**Expected:** ✅ Pattern matching works correctly

---

## 3. AGENT TESTS

### 3.1 Task Planning Tests

```typescript
describe('Agent Planner', () => {
  test('creates plan from user request', async () => {
    const planner = new AgentPlanner({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const plan = await planner.planTask(
      'Read config.json and update the theme to dark',
      {
        conversationHistory: [],
        availableTools: ['read_file', 'write_file', 'edit_file']
      }
    );

    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.some(t => t.tool === 'read_file')).toBe(true);
  });

  test('handles invalid LLM response gracefully', async () => {
    // Mock LLM to return invalid JSON
    const planner = new AgentPlanner({
      provider: 'anthropic',
      apiKey: 'test'
    });

    // Should fallback to simple plan
    const plan = await planner.planTask('test request', {
      conversationHistory: [],
      availableTools: []
    });

    expect(plan.tasks.length).toBe(1); // Fallback plan
  });
});
```

**Manual Test:**
1. Make API request: "Read package.json and list all dependencies"
2. Check that agent creates a plan with read_file tool
3. Verify plan has proper structure

**Expected:** ✅ Agent creates valid plans

---

### 3.2 Parallel Execution Tests

```typescript
describe('Parallel Executor', () => {
  test('executes independent tasks in parallel', async () => {
    const tasks: Task[] = [
      { id: 't1', description: 'Task 1', status: 'pending', tool: 'read_file', args: { path: 'file1.txt' } },
      { id: 't2', description: 'Task 2', status: 'pending', tool: 'read_file', args: { path: 'file2.txt' } },
      { id: 't3', description: 'Task 3', status: 'pending', tool: 'read_file', args: { path: 'file3.txt' } }
    ];

    const executor = new ParallelExecutor({});
    const startTime = Date.now();

    const result = await executor.executePlan({ tasks, strategy: 'parallel' } as TaskPlan);

    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.results.size).toBe(3);
    // Parallel execution should be faster than sequential
    expect(duration).toBeLessThan(3000); // Should complete in reasonable time
  });

  test('respects task dependencies', async () => {
    const tasks: Task[] = [
      { id: 't1', description: 'Read', status: 'pending', tool: 'read_file', args: {} },
      { id: 't2', description: 'Process', status: 'pending', tool: 'edit_file', args: {}, dependencies: ['t1'] }
    ];

    const executor = new ParallelExecutor({});
    const result = await executor.executePlan({ tasks, strategy: 'mixed' } as TaskPlan);

    // t2 should only run after t1 completes
    expect(result.success).toBe(true);
  });
});
```

**Manual Test:**
1. Create a request that requires multiple independent file reads
2. Monitor that tasks execute in parallel (faster completion)
3. Create a request with dependencies
4. Verify dependent tasks wait for prerequisites

**Expected:** ✅ Parallel execution works and respects dependencies

---

## 4. RLM TESTS

### 4.1 Map-Reduce Strategy Tests

```typescript
describe('RLM Executor', () => {
  test('handles large input with map-reduce', async () => {
    const executor = new RLMExecutor({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const largeText = 'Long document...'.repeat(1000); // Simulated large document

    const result = await executor.execute(
      'Summarize this document',
      { document: largeText },
      'map-reduce'
    );

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.trajectory?.totalCalls).toBeGreaterThan(1); // Should make multiple calls
  });

  test('falls back to direct call for small input', async () => {
    const executor = new RLMExecutor({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const result = await executor.execute(
      'Analyze this',
      { text: 'Short text' },
      'map-reduce'
    );

    expect(result.success).toBe(true);
    expect(result.trajectory?.totalCalls).toBe(1); // Direct call
  });
});
```

**Manual Test:**
```bash
# Test with large codebase
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Use analyze_codebase to find all security issues in src/"
    }]
  }'
```

**Expected:** ✅ RLM processes large inputs correctly

---

### 4.2 Recursive Decomposition Tests

```typescript
test('decomposes complex task into subtasks', async () => {
  const executor = new RLMExecutor({
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!
  });

  const result = await executor.execute(
    'Refactor this codebase for better performance',
    { codeFiles: { /* multiple files */ } },
    'recursive-decomposition'
  );

  expect(result.success).toBe(true);
  expect(result.trajectory?.totalCalls).toBeGreaterThan(2); // Decompose + subtasks + combine
});
```

**Expected:** ✅ Task decomposition works correctly

---

## 5. UI ACCESSIBILITY TESTS

### 5.1 Contrast Ratio Tests

```typescript
describe('UI Contrast', () => {
  test('Message text meets WCAG AA standards', () => {
    // text-gray-100 on dark background
    const contrast = calculateContrastRatio('#F3F4F6', '#0A0A0A');
    expect(contrast).toBeGreaterThanOrEqual(4.5); // WCAG AA requirement
  });

  test('Placeholder text meets minimum contrast', () => {
    // white/60 on dark
    const contrast = calculateContrastRatio('rgba(255,255,255,0.6)', '#0A0A0A');
    expect(contrast).toBeGreaterThanOrEqual(3.0);
  });

  test('Code language labels are readable', () => {
    // white/80 on dark
    const contrast = calculateContrastRatio('rgba(255,255,255,0.8)', '#0A0A0A');
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
```

**Manual Test:**
1. Open the app in dark mode
2. Use browser devtools to inspect text elements
3. Use accessibility checker (e.g., axe DevTools)
4. Verify all text is easily readable

**Expected:** ✅ All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

---

### 5.2 Visual Regression Tests

**Manual Test:**
1. Compare screenshots before/after contrast fixes
2. Verify improved readability
3. Check that colors are not too bright (avoid eye strain)

**Expected:** ✅ Text is more readable without being jarring

---

## 6. EDGE CASE TESTS

### 6.1 Error Handling Tests

```typescript
describe('Error Handling', () => {
  test('handles file not found gracefully', async () => {
    const result = await editFileTool.execute({
      path: 'nonexistent.txt',
      search: 'test',
      replace: 'test2'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('handles malformed JSON from LLM', async () => {
    // RLM should fallback when LLM returns invalid JSON
    const executor = new RLMExecutor({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    // Even if LLM returns bad JSON, should not crash
    const result = await executor.execute(
      'test task',
      { data: 'test' },
      'recursive-decomposition'
    );

    // Should either succeed or return graceful error
    expect(result.success !== undefined).toBe(true);
  });

  test('handles API rate limits', async () => {
    // Test multiple rapid API calls
    // Should handle rate limit errors gracefully
  });
});
```

**Expected:** ✅ All errors are handled gracefully with clear messages

---

### 6.2 Security Tests

```typescript
describe('Security', () => {
  test('edit tool prevents path traversal', async () => {
    const result = await editFileTool.execute({
      path: '../../../etc/passwd',
      search: 'root',
      replace: 'hacked'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('escapes workspace');
  });

  test('grep tool prevents path traversal', async () => {
    const result = await grepTool.execute({
      pattern: 'test',
      path: '../../../etc'
    });

    expect(result.success).toBe(false);
  });

  test('batch delete requires dry_run', async () => {
    const result = await batchDeleteTool.execute({
      pattern: '*.txt',
      dry_run: true // Should default to true
    });

    expect(result.dry_run).toBe(true);
  });
});
```

**Expected:** ✅ Path traversal attacks are prevented

---

## 7. INTEGRATION TESTS

### 7.1 End-to-End Workflow Tests

**Test Scenario: Refactor codebase**
1. User: "Refactor all JavaScript files to TypeScript"
2. Agent should:
   - Plan task (find files, convert each, update imports)
   - Execute in parallel where possible
   - Self-correct if errors occur

**Test Scenario: Security audit**
1. User: "Analyze codebase for security issues"
2. RLM should:
   - Scan all files
   - Use map-reduce to process in chunks
   - Aggregate findings

**Expected:** ✅ Complex workflows complete successfully

---

## 8. PERFORMANCE TESTS

```typescript
describe('Performance', () => {
  test('parallel execution is faster than sequential', async () => {
    const tasks = Array(5).fill(null).map((_, i) => ({
      id: `t${i}`,
      description: `Task ${i}`,
      status: 'pending' as const,
      tool: 'read_file',
      args: { path: `file${i}.txt` }
    }));

    // Sequential
    const seqStart = Date.now();
    for (const task of tasks) {
      await executeTask(task);
    }
    const seqTime = Date.now() - seqStart;

    // Parallel
    const parStart = Date.now();
    await Promise.all(tasks.map(executeTask));
    const parTime = Date.now() - parStart;

    expect(parTime).toBeLessThan(seqTime);
  });

  test('RLM handles 100+ files efficiently', async () => {
    // Create 100 test files
    const files = Object.fromEntries(
      Array(100).fill(null).map((_, i) => [`file${i}.js`, `content${i}`])
    );

    const executor = new RLMExecutor({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    const startTime = Date.now();
    const result = await executor.execute(
      'Analyze all files',
      { files },
      'map-reduce'
    );
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(180000); // Should complete within 3 minutes
  });
});
```

**Expected:** ✅ Performance meets targets

---

## Running the Tests

### Setup
```bash
npm install --save-dev jest @types/jest ts-jest
npx ts-jest config:init
```

### Create Test Files
```bash
mkdir -p src/__tests__/utils
mkdir -p src/__tests__/tools
mkdir -p src/__tests__/agent
mkdir -p src/__tests__/rlm
```

### Run Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/__tests__/utils/validation.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## Test Coverage Goals

- **Unit Tests:** 90%+ coverage
- **Integration Tests:** 80%+ coverage
- **E2E Tests:** Critical workflows only

---

## Manual Testing Checklist

### Before Release:
- [ ] All tools work correctly
- [ ] Agent can plan and execute complex tasks
- [ ] RLM handles large inputs
- [ ] UI is accessible (WCAG AA)
- [ ] No console errors
- [ ] All edge cases handled
- [ ] Security vulnerabilities fixed
- [ ] Performance is acceptable
- [ ] Documentation is accurate

---

## Automated Testing

Consider setting up:
1. **GitHub Actions** - Run tests on every commit
2. **Pre-commit hooks** - Run tests before commit
3. **Continuous integration** - Automated testing pipeline

---

**Status:** Test suite ready for implementation
**Next:** Create actual test files and run them
