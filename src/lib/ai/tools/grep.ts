/**
 * Grep Tool - Content Search
 *
 * Search for patterns in files (similar to grep/ripgrep)
 */

import { Tool } from "../types";
import * as fs from "fs/promises";
import * as path from "path";

const WORKSPACE_ROOT = process.cwd();

export const grepTool: Tool = {
  definition: {
    name: "grep",
    description: `Search for text patterns in files (like grep/ripgrep).

Use this to:
- Find specific code patterns
- Search for variable/function usage
- Locate configuration values
- Find all files containing a string

Supports:
- Regex patterns
- Case-sensitive/insensitive search
- Recursive directory search
- Multiple file types

Better than read_file when you don't know where something is located.`,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The pattern to search for (supports regex)",
        },
        path: {
          type: "string",
          description: "Path to search in (file or directory). Default: current directory",
        },
        recursive: {
          type: "boolean",
          description: "Search recursively in directories. Default: true",
        },
        case_insensitive: {
          type: "boolean",
          description: "Case-insensitive search. Default: false",
        },
        file_pattern: {
          type: "string",
          description: "Only search files matching this pattern (e.g., '*.ts', '*.{js,jsx}')",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return. Default: 100",
        },
        context_lines: {
          type: "number",
          description: "Number of context lines to show before/after match. Default: 0",
        },
      },
      required: ["pattern"],
    },
  },
  execute: async (args) => {
    const {
      pattern,
      path: searchPath = ".",
      recursive = true,
      case_insensitive = false,
      file_pattern,
      max_results = 100,
      context_lines = 0,
    } = args as {
      pattern: string;
      path?: string;
      recursive?: boolean;
      case_insensitive?: boolean;
      file_pattern?: string;
      max_results?: number;
      context_lines?: number;
    };

    try {
      const fullPath = path.resolve(WORKSPACE_ROOT, searchPath);

      // Validate path
      if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        return { success: false, error: "Path escapes workspace" };
      }

      const stats = await fs.stat(fullPath);
      const results: Array<{
        file: string;
        line: number;
        column: number;
        match: string;
        context?: string[];
      }> = [];

      // Create regex
      const flags = case_insensitive ? 'gi' : 'g';
      const regex = new RegExp(pattern, flags);

      if (stats.isFile()) {
        // Search single file
        await searchFile(fullPath, regex, results, context_lines);
      } else if (stats.isDirectory()) {
        // Search directory
        await searchDirectory(
          fullPath,
          regex,
          results,
          recursive,
          file_pattern,
          max_results,
          context_lines
        );
      }

      return {
        success: true,
        pattern,
        search_path: searchPath,
        matches: results.slice(0, max_results),
        total_matches: results.length,
        truncated: results.length > max_results,
        message: `Found ${results.length} match(es)${results.length > max_results ? ` (showing first ${max_results})` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
};

async function searchFile(
  filePath: string,
  regex: RegExp,
  results: any[],
  contextLines: number
): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(WORKSPACE_ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.matchAll(regex);

      for (const match of matches) {
        const context: string[] = [];

        if (contextLines > 0) {
          // Add context before
          for (let j = Math.max(0, i - contextLines); j < i; j++) {
            context.push(`${j + 1}: ${lines[j]}`);
          }
          // Add matching line
          context.push(`${i + 1}: ${line} <-- MATCH`);
          // Add context after
          for (let j = i + 1; j < Math.min(lines.length, i + contextLines + 1); j++) {
            context.push(`${j + 1}: ${lines[j]}`);
          }
        }

        results.push({
          file: relativePath,
          line: i + 1,
          column: match.index || 0,
          match: match[0],
          ...(contextLines > 0 && { context }),
        });
      }
    }
  } catch {
    // Skip files that can't be read (binary, etc.)
  }
}

async function searchDirectory(
  dirPath: string,
  regex: RegExp,
  results: any[],
  recursive: boolean,
  filePattern?: string,
  maxResults: number = 100,
  contextLines: number = 0
): Promise<void> {
  if (results.length >= maxResults) return;

  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive && !excludeDirs.includes(entry.name)) {
          await searchDirectory(fullPath, regex, results, recursive, filePattern, maxResults, contextLines);
        }
      } else if (entry.isFile()) {
        // Check file pattern if specified
        if (filePattern && !matchFilePattern(entry.name, filePattern)) {
          continue;
        }

        await searchFile(fullPath, regex, results, contextLines);
      }
    }
  } catch {
    // Skip directories that can't be read
  }
}

function matchFilePattern(fileName: string, pattern: string): boolean {
  // Simple glob pattern matching
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return fileName.endsWith(ext);
  }

  if (pattern.includes('{') && pattern.includes('}')) {
    // Handle {js,jsx,ts,tsx} patterns
    const match = pattern.match(/\{([^}]+)\}/);
    if (match) {
      const extensions = match[1].split(',');
      return extensions.some(ext => fileName.endsWith(`.${ext.trim()}`));
    }
  }

  // Exact match
  return fileName.includes(pattern);
}

/**
 * Find files by name
 */
export const findFileTool: Tool = {
  definition: {
    name: "find_file",
    description: `Find files by name pattern.

Use this to locate files when you know the name but not the path.
Supports glob patterns like:
- "package.json" - exact name
- "*.ts" - all TypeScript files
- "test*.py" - files starting with 'test' and ending in '.py'`,
    parameters: {
      type: "object",
      properties: {
        name_pattern: {
          type: "string",
          description: "File name pattern to search for",
        },
        path: {
          type: "string",
          description: "Path to search in. Default: current directory",
        },
        max_depth: {
          type: "number",
          description: "Maximum directory depth to search. Default: 10",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results. Default: 50",
        },
      },
      required: ["name_pattern"],
    },
  },
  execute: async (args) => {
    const {
      name_pattern,
      path: searchPath = ".",
      max_depth = 10,
      max_results = 50,
    } = args as {
      name_pattern: string;
      path?: string;
      max_depth?: number;
      max_results?: number;
    };

    try {
      const fullPath = path.resolve(WORKSPACE_ROOT, searchPath);

      if (!fullPath.startsWith(WORKSPACE_ROOT)) {
        return { success: false, error: "Path escapes workspace" };
      }

      const results: string[] = [];

      await findFiles(fullPath, name_pattern, results, 0, max_depth, max_results);

      return {
        success: true,
        pattern: name_pattern,
        matches: results,
        count: results.length,
        message: `Found ${results.length} file(s) matching '${name_pattern}'`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Find failed",
      };
    }
  },
};

async function findFiles(
  dirPath: string,
  pattern: string,
  results: string[],
  depth: number,
  maxDepth: number,
  maxResults: number
): Promise<void> {
  if (depth > maxDepth || results.length >= maxResults) return;

  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          const fullPath = path.join(dirPath, entry.name);
          await findFiles(fullPath, pattern, results, depth + 1, maxDepth, maxResults);
        }
      } else if (entry.isFile()) {
        if (matchFilePattern(entry.name, pattern)) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(WORKSPACE_ROOT, fullPath);
          results.push(relativePath);
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}
