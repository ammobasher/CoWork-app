/**
 * Batch Operations Tool
 *
 * Perform operations on multiple files at once
 */

import { Tool } from "../types";
import * as fs from "fs/promises";
import * as path from "path";
import { hasFileSystemAccess } from "@/lib/utils/runtime";

const WORKSPACE_ROOT = process.cwd();

export const batchRenameTool: Tool = {
  definition: {
    name: "batch_rename",
    description: `Rename multiple files at once using pattern matching and replacement.

Useful for:
- Renaming file extensions
- Adding prefixes/suffixes
- Standardizing naming conventions

Example:
- Pattern: "*.jsx" Replace: "*.tsx" - converts all .jsx files to .tsx`,
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory containing files to rename. Default: current directory",
        },
        pattern: {
          type: "string",
          description: "Pattern to match files (glob pattern)",
        },
        find: {
          type: "string",
          description: "String to find in filename",
        },
        replace: {
          type: "string",
          description: "String to replace with",
        },
        dry_run: {
          type: "boolean",
          description: "If true, show what would be renamed without actually renaming. Default: true",
        },
      },
      required: ["pattern", "find", "replace"],
    },
  },
  execute: async (args) => {
    // Runtime check - file system operations require Node.js
    if (!hasFileSystemAccess()) {
      return {
        success: false,
        error: 'File system operations are not available in this runtime environment',
        hint: 'This tool requires Node.js runtime. Ensure API routes are running server-side.',
      };
    }

    const {
      directory = ".",
      pattern,
      find,
      replace,
      dry_run = true,
    } = args as {
      directory?: string;
      pattern: string;
      find: string;
      replace: string;
      dry_run?: boolean;
    };

    try {
      const fullPath = path.resolve(WORKSPACE_ROOT, directory);

      if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        return { success: false, error: "Path escapes workspace" };
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const renames: Array<{ from: string; to: string }> = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        // Check if file matches pattern
        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          if (!entry.name.endsWith(ext)) continue;
        } else if (!entry.name.includes(pattern)) {
          continue;
        }

        // Check if filename contains find string
        if (!entry.name.includes(find)) continue;

        const newName = entry.name.replace(find, replace);
        renames.push({
          from: entry.name,
          to: newName,
        });
      }

      if (!dry_run) {
        // Actually rename files
        for (const rename of renames) {
          const fromPath = path.join(fullPath, rename.from);
          const toPath = path.join(fullPath, rename.to);
          await fs.rename(fromPath, toPath);
        }
      }

      return {
        success: true,
        directory,
        renames,
        count: renames.length,
        dry_run,
        message: dry_run
          ? `Would rename ${renames.length} file(s) (dry run)`
          : `Renamed ${renames.length} file(s)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Batch rename failed",
      };
    }
  },
};

export const batchDeleteTool: Tool = {
  definition: {
    name: "batch_delete",
    description: `Delete multiple files matching a pattern.

WARNING: This is destructive! Use dry_run first to see what will be deleted.

Useful for:
- Cleaning up generated files
- Removing temporary files
- Bulk file deletion`,
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory containing files to delete. Default: current directory",
        },
        pattern: {
          type: "string",
          description: "Pattern to match files (e.g., '*.log', 'temp_*')",
        },
        dry_run: {
          type: "boolean",
          description: "If true, show what would be deleted without actually deleting. Default: true",
        },
      },
      required: ["pattern"],
    },
  },
  execute: async (args) => {
    // Runtime check - file system operations require Node.js
    if (!hasFileSystemAccess()) {
      return {
        success: false,
        error: 'File system operations are not available in this runtime environment',
        hint: 'This tool requires Node.js runtime. Ensure API routes are running server-side.',
      };
    }

    const {
      directory = ".",
      pattern,
      dry_run = true,
    } = args as {
      directory?: string;
      pattern: string;
      dry_run?: boolean;
    };

    try {
      const fullPath = path.resolve(WORKSPACE_ROOT, directory);

      if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        return { success: false, error: "Path escapes workspace" };
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const toDelete: string[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        let matches = false;

        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          matches = entry.name.endsWith(ext);
        } else if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          matches = entry.name.startsWith(prefix);
        } else {
          matches = entry.name.includes(pattern);
        }

        if (matches) {
          toDelete.push(entry.name);
        }
      }

      if (!dry_run) {
        // Actually delete files
        for (const file of toDelete) {
          const filePath = path.join(fullPath, file);
          await fs.unlink(filePath);
        }
      }

      return {
        success: true,
        directory,
        files: toDelete,
        count: toDelete.length,
        dry_run,
        message: dry_run
          ? `Would delete ${toDelete.length} file(s) (dry run)`
          : `Deleted ${toDelete.length} file(s)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Batch delete failed",
      };
    }
  },
};

export const batchCopyTool: Tool = {
  definition: {
    name: "batch_copy",
    description: `Copy multiple files from one directory to another.

Useful for:
- Duplicating file structures
- Creating backups
- Copying templates`,
    parameters: {
      type: "object",
      properties: {
        from_directory: {
          type: "string",
          description: "Source directory",
        },
        to_directory: {
          type: "string",
          description: "Destination directory",
        },
        pattern: {
          type: "string",
          description: "Pattern to match files (e.g., '*.ts', '*')",
        },
        create_destination: {
          type: "boolean",
          description: "Create destination directory if it doesn't exist. Default: true",
        },
      },
      required: ["from_directory", "to_directory", "pattern"],
    },
  },
  execute: async (args) => {
    // Runtime check - file system operations require Node.js
    if (!hasFileSystemAccess()) {
      return {
        success: false,
        error: 'File system operations are not available in this runtime environment',
        hint: 'This tool requires Node.js runtime. Ensure API routes are running server-side.',
      };
    }

    const {
      from_directory,
      to_directory,
      pattern,
      create_destination = true,
    } = args as {
      from_directory: string;
      to_directory: string;
      pattern: string;
      create_destination?: boolean;
    };

    try {
      const fromPath = path.resolve(WORKSPACE_ROOT, from_directory);
      const toPath = path.resolve(WORKSPACE_ROOT, to_directory);

      if (!fromPath.startsWith(WORKSPACE_ROOT) || !toPath.startsWith(WORKSPACE_ROOT)) {
        return { success: false, error: "Path escapes workspace" };
      }

      // Create destination if needed
      if (create_destination) {
        await fs.mkdir(toPath, { recursive: true });
      }

      const entries = await fs.readdir(fromPath, { withFileTypes: true });
      const copied: string[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        let matches = false;

        if (pattern === '*') {
          matches = true;
        } else if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          matches = entry.name.endsWith(ext);
        } else {
          matches = entry.name.includes(pattern);
        }

        if (matches) {
          const fromFile = path.join(fromPath, entry.name);
          const toFile = path.join(toPath, entry.name);
          await fs.copyFile(fromFile, toFile);
          copied.push(entry.name);
        }
      }

      return {
        success: true,
        from: from_directory,
        to: to_directory,
        files: copied,
        count: copied.length,
        message: `Copied ${copied.length} file(s) from ${from_directory} to ${to_directory}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Batch copy failed",
      };
    }
  },
};
