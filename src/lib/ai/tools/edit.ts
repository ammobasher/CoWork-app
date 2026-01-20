/**
 * Edit Tool - Targeted File Editing
 *
 * Make precise edits to files without rewriting the entire content
 */

import { Tool } from "../types";
import * as fs from "fs/promises";
import * as path from "path";
import { hasFileSystemAccess } from "@/lib/utils/runtime";

const WORKSPACE_ROOT = process.cwd();

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

export const editFileTool: Tool = {
  definition: {
    name: "edit_file",
    description: `Make targeted edits to a file by searching for specific content and replacing it.

This is more precise than write_file which overwrites the entire file.
Use this when you need to:
- Update specific lines or sections
- Replace function implementations
- Modify configuration values
- Rename variables/functions

The search string must match EXACTLY (including whitespace).`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file",
        },
        search: {
          type: "string",
          description: "Exact content to search for (will be replaced). Must match exactly including whitespace.",
        },
        replace: {
          type: "string",
          description: "New content to insert in place of search string",
        },
        replace_all: {
          type: "boolean",
          description: "Replace all occurrences (default: false, replaces only first occurrence)",
        },
      },
      required: ["path", "search", "replace"],
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

    const { path: filePath, search, replace, replace_all = false } = args as {
      path: string;
      search: string;
      replace: string;
      replace_all?: boolean;
    };

    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Read the file
      const content = await fs.readFile(validation.resolvedPath, 'utf-8');

      // Check if search string exists
      if (!content.includes(search)) {
        return {
          success: false,
          error: `Search string not found in file.\n\nSearching for:\n${search.slice(0, 200)}`,
          searched_for: search.slice(0, 500),
        };
      }

      // Perform replacement
      const newContent = replace_all
        ? content.replaceAll(search, replace)
        : content.replace(search, replace);

      // Count occurrences
      const occurrences = (content.match(new RegExp(escapeRegex(search), 'g')) || []).length;
      const replaced = replace_all ? occurrences : 1;

      // Write back
      await fs.writeFile(validation.resolvedPath, newContent, 'utf-8');

      return {
        success: true,
        path: filePath,
        replacements: replaced,
        total_occurrences: occurrences,
        message: `Made ${replaced} replacement(s) in ${filePath}${occurrences > replaced ? ` (${occurrences - replaced} more occurrence(s) remain)` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Edit failed",
      };
    }
  },
};

/**
 * Multi-edit tool - make multiple edits in one operation
 */
export const multiEditTool: Tool = {
  definition: {
    name: "multi_edit",
    description: `Make multiple edits to a file in a single operation.

Useful for:
- Updating multiple functions
- Replacing multiple variables
- Making several related changes

Edits are applied in order, so later edits see the results of earlier ones.`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file",
        },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              search: { type: "string" },
              replace: { type: "string" },
            },
            required: ["search", "replace"],
          },
          description: "Array of edits to apply in order",
        },
      },
      required: ["path", "edits"],
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

    const { path: filePath, edits } = args as {
      path: string;
      edits: Array<{ search: string; replace: string }>;
    };

    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      let content = await fs.readFile(validation.resolvedPath, 'utf-8');
      const applied: Array<{ search: string; found: boolean }> = [];
      let totalReplacements = 0;

      for (const edit of edits) {
        if (content.includes(edit.search)) {
          content = content.replace(edit.search, edit.replace);
          applied.push({ search: edit.search.slice(0, 50), found: true });
          totalReplacements++;
        } else {
          applied.push({ search: edit.search.slice(0, 50), found: false });
        }
      }

      await fs.writeFile(validation.resolvedPath, content, 'utf-8');

      const notFound = applied.filter(e => !e.found);

      return {
        success: true,
        path: filePath,
        total_edits: edits.length,
        applied: totalReplacements,
        not_found: notFound.length,
        details: applied,
        message: `Applied ${totalReplacements}/${edits.length} edits to ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Multi-edit failed",
      };
    }
  },
};

/**
 * Insert text at specific line
 */
export const insertLineTool: Tool = {
  definition: {
    name: "insert_line",
    description: `Insert text at a specific line number in a file.

Useful for:
- Adding imports
- Inserting function definitions
- Adding configuration entries

Line numbers are 1-based (first line is line 1).`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file",
        },
        line: {
          type: "number",
          description: "Line number to insert at (1-based). Line will be inserted BEFORE this line.",
        },
        content: {
          type: "string",
          description: "Content to insert",
        },
      },
      required: ["path", "line", "content"],
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

    const { path: filePath, line, content } = args as {
      path: string;
      line: number;
      content: string;
    };

    const validation = validatePath(filePath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const fileContent = await fs.readFile(validation.resolvedPath, 'utf-8');
      const lines = fileContent.split('\n');

      if (line < 1 || line > lines.length + 1) {
        return {
          success: false,
          error: `Invalid line number ${line}. File has ${lines.length} lines.`,
        };
      }

      // Insert the content
      lines.splice(line - 1, 0, content);

      await fs.writeFile(validation.resolvedPath, lines.join('\n'), 'utf-8');

      return {
        success: true,
        path: filePath,
        line,
        message: `Inserted content at line ${line} in ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Insert failed",
      };
    }
  },
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
