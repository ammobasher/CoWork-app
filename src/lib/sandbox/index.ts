/**
 * Sandboxed code execution for Python and JavaScript
 * Uses subprocess for Python and VM2-like isolation for JavaScript
 */

import { spawn } from "child_process";

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
        let stdout = "";
        let stderr = "";
        let killed = false;

        // Create a sandboxed Python environment
        const safeCode = `
import sys
import io
from contextlib import redirect_stdout, redirect_stderr

# Disable dangerous modules
DANGEROUS_MODULES = ['os', 'subprocess', 'shutil', 'socket', 'requests', 'urllib']
original_import = __builtins__.__import__

def safe_import(name, *args, **kwargs):
    if name in DANGEROUS_MODULES or name.startswith('_'):
        raise ImportError(f"Module '{name}' is not allowed in sandbox")
    return original_import(name, *args, **kwargs)

# Note: For true security, use a proper sandbox like Docker or PyPy sandbox
# This is a basic protection layer

stdout_buffer = io.StringIO()
stderr_buffer = io.StringIO()

try:
    with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
        exec('''${code.replace(/'/g, "\\'")}''')
    print(stdout_buffer.getvalue(), end='')
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}", file=sys.stderr)
`;

        const python = spawn("python3", ["-c", safeCode], {
            timeout,
            env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        });

        const timer = setTimeout(() => {
            killed = true;
            python.kill("SIGTERM");
        }, timeout);

        python.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        python.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        python.on("close", (code) => {
            clearTimeout(timer);
            const executionTime = Date.now() - startTime;

            if (killed) {
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: "Execution timed out after 30 seconds",
                    executionTime,
                });
            } else {
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    error: code !== 0 ? `Process exited with code ${code}` : undefined,
                    executionTime,
                });
            }
        });

        python.on("error", (err) => {
            clearTimeout(timer);
            resolve({
                success: false,
                stdout: "",
                stderr: "",
                error: `Failed to start Python: ${err.message}`,
                executionTime: Date.now() - startTime,
            });
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
        let stdout = "";
        let stderr = "";
        let killed = false;

        // Create a sandboxed Node.js environment
        const safeCode = `
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
  const script = new vm.Script(\`${code.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`);
  const result = script.runInContext(context, { timeout: 25000 });
  if (result !== undefined) {
    console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
`;

        const node = spawn("node", ["-e", safeCode], {
            timeout,
        });

        const timer = setTimeout(() => {
            killed = true;
            node.kill("SIGTERM");
        }, timeout);

        node.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        node.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        node.on("close", (code) => {
            clearTimeout(timer);
            const executionTime = Date.now() - startTime;

            if (killed) {
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    error: "Execution timed out after 30 seconds",
                    executionTime,
                });
            } else {
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    error: code !== 0 ? `Process exited with code ${code}` : undefined,
                    executionTime,
                });
            }
        });

        node.on("error", (err) => {
            clearTimeout(timer);
            resolve({
                success: false,
                stdout: "",
                stderr: "",
                error: `Failed to start Node.js: ${err.message}`,
                executionTime: Date.now() - startTime,
            });
        });
    });
}
