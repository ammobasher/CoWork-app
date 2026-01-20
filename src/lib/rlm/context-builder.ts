/**
 * Context Builder for RLM
 *
 * Build context from codebases, files, and other sources
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContextBuildOptions {
  extensions?: string[];
  exclude?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  includeMetadata?: boolean;
}

export interface FileMetadata {
  path: string;
  size: number;
  lastModified: Date;
  extension: string;
  lines?: number;
}

export interface CodebaseContext {
  files: Record<string, string>;
  metadata?: Record<string, FileMetadata>;
  structure?: DirectoryStructure;
  stats?: {
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  };
}

export interface DirectoryStructure {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryStructure[];
  path: string;
}

/**
 * Build context from a codebase directory
 */
export async function buildCodebaseContext(
  rootPath: string,
  options: ContextBuildOptions = {}
): Promise<CodebaseContext> {
  const {
    extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h'],
    exclude = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__'],
    maxFileSize = 100_000, // 100KB per file
    maxFiles = 100,
    includeMetadata = true,
  } = options;

  const files: Record<string, string> = {};
  const metadata: Record<string, FileMetadata> = {};
  const fileTypes: Record<string, number> = {};
  let totalSize = 0;
  let fileCount = 0;

  async function scanDir(dir: string): Promise<void> {
    if (fileCount >= maxFiles) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (fileCount >= maxFiles) break;

        // Skip excluded directories
        if (exclude.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);

          // Check if file extension is allowed
          if (extensions.length > 0 && !extensions.includes(ext)) continue;

          try {
            const stats = await fs.stat(fullPath);

            // Skip files that are too large
            if (stats.size > maxFileSize) continue;

            // Read file content
            const content = await fs.readFile(fullPath, 'utf-8');
            files[relativePath] = content;
            totalSize += stats.size;
            fileCount++;

            // Track file types
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;

            // Build metadata
            if (includeMetadata) {
              metadata[relativePath] = {
                path: relativePath,
                size: stats.size,
                lastModified: stats.mtime,
                extension: ext,
                lines: content.split('\n').length,
              };
            }
          } catch (error) {
            // Skip files that can't be read (binary, permissions, etc.)
            continue;
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      return;
    }
  }

  await scanDir(rootPath);

  const result: CodebaseContext = {
    files,
    stats: {
      totalFiles: fileCount,
      totalSize,
      fileTypes,
    },
  };

  if (includeMetadata) {
    result.metadata = metadata;
  }

  return result;
}

/**
 * Build context from specific files
 */
export async function buildFileContext(
  filePaths: string[],
  workspaceRoot: string = process.cwd()
): Promise<Record<string, string>> {
  const context: Record<string, string> = {};

  for (const filePath of filePaths) {
    try {
      const fullPath = path.resolve(workspaceRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const relativePath = path.relative(workspaceRoot, fullPath);
      context[relativePath] = content;
    } catch (error) {
      // Skip files that can't be read
      console.error(`Failed to read ${filePath}:`, error);
    }
  }

  return context;
}

/**
 * Build directory structure tree
 */
export async function buildDirectoryStructure(
  rootPath: string,
  options: Pick<ContextBuildOptions, 'exclude'> = {}
): Promise<DirectoryStructure> {
  const { exclude = ['node_modules', '.git', 'dist', 'build'] } = options;

  async function buildTree(dir: string, depth: number = 0): Promise<DirectoryStructure> {
    const stats = await fs.stat(dir);
    const name = path.basename(dir);

    if (stats.isFile()) {
      return {
        name,
        type: 'file',
        path: path.relative(rootPath, dir),
      };
    }

    // Limit depth to prevent infinite recursion
    if (depth > 5) {
      return {
        name,
        type: 'directory',
        path: path.relative(rootPath, dir),
        children: [],
      };
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const children: DirectoryStructure[] = [];

    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      try {
        const child = await buildTree(fullPath, depth + 1);
        children.push(child);
      } catch {
        // Skip entries that can't be accessed
      }
    }

    return {
      name,
      type: 'directory',
      path: path.relative(rootPath, dir),
      children: children.sort((a, b) => {
        // Directories first, then files, alphabetically
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  return buildTree(rootPath);
}

/**
 * Build context summary (lightweight, just metadata)
 */
export async function buildContextSummary(
  rootPath: string,
  options: ContextBuildOptions = {}
): Promise<{ summary: string; structure: DirectoryStructure }> {
  const structure = await buildDirectoryStructure(rootPath, options);
  const context = await buildCodebaseContext(rootPath, {
    ...options,
    maxFileSize: 0, // Don't read file contents
  });

  const summary = `
Codebase Summary:
- Total Files: ${context.stats?.totalFiles || 0}
- Total Size: ${formatBytes(context.stats?.totalSize || 0)}
- File Types: ${Object.entries(context.stats?.fileTypes || {})
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ')}
`.trim();

  return { summary, structure };
}

/**
 * Helper: Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
