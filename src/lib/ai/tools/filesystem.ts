/**
 * File System Tools
 * Read, write, and manage files in the workspace
 */

import { Tool } from "../types";
import * as fs from "fs/promises";
import * as path from "path";

// Workspace root - configurable
const WORKSPACE_ROOT = process.cwd();

// Helper to validate paths are within workspace
function validatePath(filePath: string): { valid: boolean; resolvedPath: string; error?: string } {
    const resolved = path.resolve(WORKSPACE_ROOT, filePath);
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
        return {
            valid: false,
            resolvedPath: resolved,
            error: "Path escapes workspace directory",
        };
    }
    return { valid: true, resolvedPath: resolved };
}

export const readFileTool: Tool = {
    definition: {
        name: "read_file",
        description: "Read the contents of a file from the workspace. Returns the file content as text. Use this to examine code files, configuration, documentation, etc.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path to the file from workspace root",
                },
                encoding: {
                    type: "string",
                    enum: ["utf-8", "base64"],
                    description: "File encoding. Use base64 for binary files. Default: utf-8",
                },
            },
            required: ["path"],
        },
    },
    execute: async (args) => {
        const { path: filePath, encoding = "utf-8" } = args as {
            path: string;
            encoding?: "utf-8" | "base64";
        };

        const validation = validatePath(filePath);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const content = await fs.readFile(validation.resolvedPath, {
                encoding: encoding === "base64" ? "base64" : "utf-8",
            });

            const stats = await fs.stat(validation.resolvedPath);

            return {
                success: true,
                path: filePath,
                content: content.slice(0, 50000), // Limit content size
                size: stats.size,
                truncated: content.length > 50000,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to read file",
            };
        }
    },
};

export const writeFileTool: Tool = {
    definition: {
        name: "write_file",
        description: "Write content to a file in the workspace. Creates the file if it doesn't exist, or overwrites if it does. Use this to create new files or update existing ones.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path for the file",
                },
                content: {
                    type: "string",
                    description: "Content to write to the file",
                },
                createDirectories: {
                    type: "boolean",
                    description: "Create parent directories if they don't exist. Default: true",
                },
            },
            required: ["path", "content"],
        },
    },
    execute: async (args) => {
        const { path: filePath, content, createDirectories = true } = args as {
            path: string;
            content: string;
            createDirectories?: boolean;
        };

        const validation = validatePath(filePath);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            if (createDirectories) {
                await fs.mkdir(path.dirname(validation.resolvedPath), { recursive: true });
            }

            await fs.writeFile(validation.resolvedPath, content, "utf-8");

            return {
                success: true,
                path: filePath,
                bytesWritten: Buffer.byteLength(content, "utf-8"),
                message: `File written successfully: ${filePath}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to write file",
            };
        }
    },
};

export const listDirectoryTool: Tool = {
    definition: {
        name: "list_directory",
        description: "List files and directories in a workspace path. Returns file names, types (file/directory), and sizes.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path to the directory. Use '.' for workspace root.",
                },
                recursive: {
                    type: "boolean",
                    description: "If true, list contents recursively (up to 2 levels). Default: false",
                },
            },
            required: ["path"],
        },
    },
    execute: async (args) => {
        const { path: dirPath, recursive = false } = args as {
            path: string;
            recursive?: boolean;
        };

        const validation = validatePath(dirPath);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const entries: Array<{
                name: string;
                type: "file" | "directory";
                size?: number;
                children?: Array<{ name: string; type: string }>;
            }> = [];

            const items = await fs.readdir(validation.resolvedPath, { withFileTypes: true });

            for (const item of items.slice(0, 100)) { // Limit entries
                const entryPath = path.join(validation.resolvedPath, item.name);
                const entry: typeof entries[0] = {
                    name: item.name,
                    type: item.isDirectory() ? "directory" : "file",
                };

                if (item.isFile()) {
                    const stats = await fs.stat(entryPath);
                    entry.size = stats.size;
                } else if (item.isDirectory() && recursive) {
                    try {
                        const subItems = await fs.readdir(entryPath, { withFileTypes: true });
                        entry.children = subItems.slice(0, 20).map((sub) => ({
                            name: sub.name,
                            type: sub.isDirectory() ? "directory" : "file",
                        }));
                    } catch {
                        // Skip inaccessible directories
                    }
                }

                entries.push(entry);
            }

            return {
                success: true,
                path: dirPath,
                entries,
                count: entries.length,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list directory",
            };
        }
    },
};

export const searchFilesTool: Tool = {
    definition: {
        name: "search_files",
        description: "Search for files by name or pattern in the workspace. Useful for finding specific files without knowing exact paths.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "Glob pattern or file name to search for (e.g., '*.ts', 'package.json', 'src/**/*.tsx')",
                },
                directory: {
                    type: "string",
                    description: "Directory to search in. Default: workspace root",
                },
            },
            required: ["pattern"],
        },
    },
    execute: async (args) => {
        const { pattern, directory = "." } = args as {
            pattern: string;
            directory?: string;
        };

        const validation = validatePath(directory);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const matches: string[] = [];

            async function searchDir(dir: string, depth: number = 0): Promise<void> {
                if (depth > 5 || matches.length >= 50) return; // Limit depth and results

                const items = await fs.readdir(dir, { withFileTypes: true });

                for (const item of items) {
                    if (item.name.startsWith(".") || item.name === "node_modules") continue;

                    const fullPath = path.join(dir, item.name);
                    const relativePath = path.relative(WORKSPACE_ROOT, fullPath);

                    // Simple pattern matching
                    const matchesPattern =
                        item.name.includes(pattern.replace("*", "")) ||
                        relativePath.includes(pattern.replace("*", "")) ||
                        (pattern.startsWith("*.") && item.name.endsWith(pattern.slice(1)));

                    if (matchesPattern && item.isFile()) {
                        matches.push(relativePath);
                    }

                    if (item.isDirectory()) {
                        await searchDir(fullPath, depth + 1);
                    }
                }
            }

            await searchDir(validation.resolvedPath);

            return {
                success: true,
                pattern,
                matches,
                count: matches.length,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Search failed",
            };
        }
    },
};
