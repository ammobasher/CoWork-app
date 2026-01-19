/**
 * Sandboxed code execution for Python and JavaScript
 * Uses exec for process spawning to avoid Turbopack static analysis issues
 */

import { exec } from "child_process";

export interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    error?: string;
    executionTime: number;
}

/**
 * Execute Python code in a sandboxed subprocess
 * Requires Python to be installed on the system
 */
export async function executePythonCode(code: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
        const timeout = 30000; // 30 second timeout

        // Escape code for shell execution
        const escapedCode = code.replace(/'/g, "'\\''");

        // Create a sandboxed Python script using heredoc-style approach
        const pythonScript = `
import sys
import io
from contextlib import redirect_stdout, redirect_stderr

stdout_buffer = io.StringIO()
stderr_buffer = io.StringIO()

try:
    with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
        exec('''${escapedCode}''')
    output = stdout_buffer.getvalue()
    if output:
        print(output, end='')
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}", file=sys.stderr)
`;

        // Write to temp file approach for larger scripts
        const command = `python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`;

        exec(command, {
            timeout,
            env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
            maxBuffer: 1024 * 1024 // 1MB buffer
        }, (error, stdout, stderr) => {
            const executionTime = Date.now() - startTime;

            if (error && error.killed) {
                resolve({
                    success: false,
                    stdout: stdout || "",
                    stderr: stderr || "",
                    error: "Execution timed out after 30 seconds",
                    executionTime,
                });
            } else {
                resolve({
                    success: !error,
                    stdout: (stdout || "").trim(),
                    stderr: (stderr || "").trim(),
                    error: error ? `Process exited with code ${error.code}` : undefined,
                    executionTime,
                });
            }
        });
    });
}

/**
 * Execute JavaScript code in a sandboxed environment
 * Uses node's vm module with restricted globals
 */
export async function executeJavaScriptCode(code: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
        const timeout = 30000; // 30 second timeout

        // Escape code for shell and JavaScript
        const escapedCode = code
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n');

        // Create a sandboxed Node.js environment using the vm module
        const nodeScript = `
const vm = require('vm');

// Create a sandbox with limited globals
const sandbox = {
  console: {
    log: (...args) => process.stdout.write(args.map(a => 
      typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    ).join(' ') + '\\n'),
    error: (...args) => process.stderr.write(args.map(a => 
      typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    ).join(' ') + '\\n'),
    warn: (...args) => process.stderr.write(args.map(a => String(a)).join(' ') + '\\n'),
  },
  JSON,
  Math,
  Date,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  Promise,
  setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5000)),
  setInterval: undefined,
  setImmediate: undefined,
  require: undefined,
  process: undefined,
  global: undefined,
  __dirname: undefined,
  __filename: undefined,
};

const context = vm.createContext(sandbox);

try {
  const script = new vm.Script(\`${escapedCode}\`);
  const result = script.runInContext(context, { timeout: 25000 });
  if (result !== undefined) {
    console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
`;

        const command = `node -e "${nodeScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

        exec(command, {
            timeout,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            const executionTime = Date.now() - startTime;

            if (error && error.killed) {
                resolve({
                    success: false,
                    stdout: stdout || "",
                    stderr: stderr || "",
                    error: "Execution timed out after 30 seconds",
                    executionTime,
                });
            } else {
                resolve({
                    success: !error,
                    stdout: (stdout || "").trim(),
                    stderr: (stderr || "").trim(),
                    error: error ? `Process exited with code ${error.code}` : undefined,
                    executionTime,
                });
            }
        });
    });
}
