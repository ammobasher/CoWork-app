/**
 * Terminal Command Execution Tool
 * Execute shell commands in a controlled environment
 */

import { Tool } from "../types";
import { spawn } from "child_process";

// Maximum execution time
const MAX_EXECUTION_TIME = 60000; // 60 seconds

// Blocked commands for safety
const BLOCKED_COMMANDS = [
    "rm -rf /",
    "rm -rf ~",
    "mkfs",
    "dd if=",
    ":(){",
    "fork bomb",
    "> /dev/sda",
    "chmod -R 777 /",
    "sudo rm",
];

// Allowed command prefixes for safety (can be configured)
const SAFE_COMMANDS = [
    "ls", "cat", "echo", "pwd", "cd", "mkdir", "touch", "head", "tail", "grep",
    "find", "which", "whereis", "file", "wc", "sort", "uniq", "diff",
    "npm", "npx", "node", "python", "python3", "pip", "pip3",
    "git status", "git log", "git diff", "git branch", "git show",
    "cargo", "rustc", "go", "deno", "bun",
    "curl", "wget",
];

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
    const lowerCmd = command.toLowerCase().trim();

    // Check for blocked patterns
    for (const blocked of BLOCKED_COMMANDS) {
        if (lowerCmd.includes(blocked.toLowerCase())) {
            return { safe: false, reason: `Blocked pattern detected: ${blocked}` };
        }
    }

    // Check if starts with a safe command
    const firstWord = lowerCmd.split(/\s+/)[0];
    const isSafe = SAFE_COMMANDS.some(safe =>
        lowerCmd.startsWith(safe) || firstWord === safe
    );

    if (!isSafe) {
        // Allow the command but warn
        return {
            safe: true,
            reason: `Command '${firstWord}' is not in the safe list but will be allowed with caution`
        };
    }

    return { safe: true };
}

export const runCommandTool: Tool = {
    definition: {
        name: "run_command",
        description: `Execute a shell command in the workspace directory. Use this for running build commands, tests, linting, git operations, and other CLI tasks. Commands run with a 60-second timeout.`,
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The shell command to execute",
                },
                cwd: {
                    type: "string",
                    description: "Working directory for the command. Default: workspace root",
                },
                timeout: {
                    type: "number",
                    description: "Timeout in milliseconds. Max: 60000. Default: 30000",
                },
            },
            required: ["command"],
        },
    },
    execute: async (args) => {
        const { command, cwd = process.cwd(), timeout = 30000 } = args as {
            command: string;
            cwd?: string;
            timeout?: number;
        };

        // Safety check
        const safetyCheck = isCommandSafe(command);
        if (!safetyCheck.safe) {
            return {
                success: false,
                error: `Command blocked: ${safetyCheck.reason}`,
            };
        }

        const effectiveTimeout = Math.min(timeout, MAX_EXECUTION_TIME);

        return new Promise((resolve) => {
            let stdout = "";
            let stderr = "";
            let killed = false;

            const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
            const shellFlag = process.platform === "win32" ? "/c" : "-c";

            const proc = spawn(shell, [shellFlag, command], {
                cwd,
                env: {
                    ...process.env,
                    FORCE_COLOR: "0", // Disable colors for cleaner output
                },
            });

            const timer = setTimeout(() => {
                killed = true;
                proc.kill("SIGTERM");
            }, effectiveTimeout);

            proc.stdout.on("data", (data) => {
                stdout += data.toString();
                // Limit output size
                if (stdout.length > 50000) {
                    stdout = stdout.slice(0, 50000) + "\n... (output truncated)";
                }
            });

            proc.stderr.on("data", (data) => {
                stderr += data.toString();
                if (stderr.length > 50000) {
                    stderr = stderr.slice(0, 50000) + "\n... (output truncated)";
                }
            });

            proc.on("close", (code) => {
                clearTimeout(timer);

                if (killed) {
                    resolve({
                        success: false,
                        stdout,
                        stderr,
                        error: `Command timed out after ${effectiveTimeout / 1000} seconds`,
                        timedOut: true,
                    });
                } else {
                    resolve({
                        success: code === 0,
                        exitCode: code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        command,
                        warning: safetyCheck.reason,
                    });
                }
            });

            proc.on("error", (err) => {
                clearTimeout(timer);
                resolve({
                    success: false,
                    error: `Failed to execute command: ${err.message}`,
                });
            });
        });
    },
};

export const runNpmScriptTool: Tool = {
    definition: {
        name: "run_npm_script",
        description: "Run an npm script from package.json. Safer and more convenient than raw shell commands for Node.js projects.",
        parameters: {
            type: "object",
            properties: {
                script: {
                    type: "string",
                    description: "The npm script name (e.g., 'build', 'test', 'lint', 'dev')",
                },
                args: {
                    type: "array",
                    items: { type: "string" },
                    description: "Additional arguments to pass to the script",
                },
            },
            required: ["script"],
        },
    },
    execute: async (args) => {
        const { script, args: scriptArgs = [] } = args as {
            script: string;
            args?: string[];
        };

        const command = `npm run ${script}${scriptArgs.length ? " -- " + scriptArgs.join(" ") : ""}`;

        return runCommandTool.execute({ command, timeout: 60000 });
    },
};

export const gitTool: Tool = {
    definition: {
        name: "git",
        description: "Execute git commands safely. Useful for version control operations like status, diff, log, branch, commit, etc.",
        parameters: {
            type: "object",
            properties: {
                subcommand: {
                    type: "string",
                    description: "Git subcommand (e.g., 'status', 'diff', 'log', 'branch', 'add', 'commit')",
                },
                args: {
                    type: "array",
                    items: { type: "string" },
                    description: "Arguments for the git subcommand",
                },
            },
            required: ["subcommand"],
        },
    },
    execute: async (args) => {
        const { subcommand, args: gitArgs = [] } = args as {
            subcommand: string;
            args?: string[];
        };

        // Build the git command
        const command = `git ${subcommand} ${gitArgs.join(" ")}`.trim();

        // Special handling for certain commands
        if (["push", "force-push"].includes(subcommand)) {
            return {
                success: false,
                error: "Git push operations require manual execution for safety",
            };
        }

        return runCommandTool.execute({ command, timeout: 30000 });
    },
};
