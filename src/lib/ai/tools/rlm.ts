/**
 * Recursive Language Model (RLM) Tool
 *
 * Process large contexts recursively by breaking them into manageable chunks
 */

import { Tool, ToolContext } from "../types";
import { RLMExecutor } from "@/lib/rlm/executor";
import { buildCodebaseContext, buildFileContext } from "@/lib/rlm/context-builder";
import { ProcessingStrategy } from "@/lib/rlm/types";

export const rlmTool: Tool = {
  definition: {
    name: "recursive_process",
    description: `Process large inputs recursively using RLM (Recursive Language Models).

Use this tool when dealing with:
- Multiple files or entire codebases
- Long documents or datasets
- Complex multi-step analysis
- Tasks that exceed context window limits

The tool automatically chunks data, processes it recursively, and aggregates results.

Strategies:
- map-reduce: Split data, process chunks in parallel, aggregate (best for uniform data)
- recursive-decomposition: Break task into subtasks automatically (best for complex tasks)
- sequential-processing: Process items in order with state (best for dependent steps)
- tree-traversal: Navigate hierarchical structures (best for nested data)`,
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The high-level task to accomplish",
        },
        strategy: {
          type: "string",
          enum: ["map-reduce", "recursive-decomposition", "sequential-processing", "tree-traversal"],
          description: "Processing strategy to use. Default: map-reduce",
        },
        context_type: {
          type: "string",
          enum: ["codebase", "files", "custom"],
          description: "Type of context to process. Default: custom",
        },
        codebase_path: {
          type: "string",
          description: "Path to codebase directory (if context_type=codebase)",
        },
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Array of file paths (if context_type=files)",
        },
        context: {
          type: "object",
          description: "Custom context variables (if context_type=custom)",
        },
        max_recursion_depth: {
          type: "number",
          description: "Maximum recursion depth. Default: 10",
        },
      },
      required: ["task"],
    },
  },
  execute: async (args, toolContext?: ToolContext) => {
    const {
      task,
      strategy = "map-reduce",
      context_type = "custom",
      codebase_path,
      file_paths,
      context: customContext,
      max_recursion_depth = 10,
    } = args as {
      task: string;
      strategy?: ProcessingStrategy;
      context_type?: "codebase" | "files" | "custom";
      codebase_path?: string;
      file_paths?: string[];
      context?: Record<string, any>;
      max_recursion_depth?: number;
    };

    try {
      // Build context based on type
      let contextData: Record<string, any> = {};

      if (context_type === "codebase" && codebase_path) {
        const codebaseContext = await buildCodebaseContext(codebase_path, {
          maxFiles: 100,
          maxFileSize: 100_000,
        });
        contextData = {
          files: codebaseContext.files,
          metadata: codebaseContext.metadata,
          stats: codebaseContext.stats,
        };
      } else if (context_type === "files" && file_paths && file_paths.length > 0) {
        contextData = {
          files: await buildFileContext(file_paths),
        };
      } else if (context_type === "custom" && customContext) {
        contextData = customContext;
      } else {
        return {
          success: false,
          error: "Invalid context configuration. Provide codebase_path, file_paths, or context.",
        };
      }

      // Determine which provider to use based on available API keys
      let provider: 'anthropic' | 'openai' | 'gemini' = 'anthropic';
      let apiKey = '';

      if (toolContext?.apiKeys?.anthropic) {
        provider = 'anthropic';
        apiKey = toolContext.apiKeys.anthropic;
      } else if (toolContext?.apiKeys?.openai) {
        provider = 'openai';
        apiKey = toolContext.apiKeys.openai;
      } else {
        return {
          success: false,
          error: "No API key available for RLM execution. Configure Anthropic or OpenAI API key.",
        };
      }

      // Create RLM executor
      const executor = new RLMExecutor({
        provider,
        apiKey,
        maxRecursionDepth: max_recursion_depth,
        maxExecutionTime: 300000, // 5 minutes
      });

      // Execute RLM task
      const result = await executor.execute(task, contextData, strategy);

      if (result.success) {
        return {
          success: true,
          result: result.result,
          strategy_used: strategy,
          execution_time: result.executionTime,
          trajectory: {
            total_calls: result.trajectory?.totalCalls,
            max_depth: result.trajectory?.maxDepth,
          },
          message: `RLM processing completed using ${strategy} strategy. Made ${result.trajectory?.totalCalls} recursive calls.`,
        };
      } else {
        return {
          success: false,
          error: result.error,
          execution_time: result.executionTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "RLM execution failed",
      };
    }
  },
};

/**
 * Analyze Codebase Tool (Specialized RLM tool for code analysis)
 */
export const analyzeCodebaseTool: Tool = {
  definition: {
    name: "analyze_codebase",
    description: `Analyze an entire codebase using RLM for deep insights.

This tool scans all code files and uses recursive processing to:
- Identify patterns and architecture
- Find security vulnerabilities
- Analyze code quality
- Generate documentation
- Find bugs and issues

Better than read_file for analyzing multiple files or entire projects.`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the codebase directory. Default: current directory",
        },
        analysis_type: {
          type: "string",
          enum: ["security", "architecture", "quality", "documentation", "bugs", "general"],
          description: "Type of analysis to perform. Default: general",
        },
        file_extensions: {
          type: "array",
          items: { type: "string" },
          description: "File extensions to analyze (e.g., ['.ts', '.tsx']). Default: common code files",
        },
      },
      required: [],
    },
  },
  execute: async (args, toolContext?: ToolContext) => {
    const {
      path: codePath = ".",
      analysis_type = "general",
      file_extensions,
    } = args as {
      path?: string;
      analysis_type?: string;
      file_extensions?: string[];
    };

    const analysisPrompts: Record<string, string> = {
      security: "Analyze this codebase for security vulnerabilities. Look for: SQL injection, XSS, authentication issues, hardcoded secrets, insecure dependencies, and other OWASP Top 10 issues. For each issue found, provide: location, severity, description, and fix.",
      architecture: "Analyze the architecture of this codebase. Describe: overall structure, design patterns used, component organization, data flow, dependencies, and architectural strengths/weaknesses.",
      quality: "Analyze code quality. Check for: code smells, complexity issues, duplication, naming conventions, documentation, test coverage, and best practices. Provide specific recommendations.",
      documentation: "Generate comprehensive documentation for this codebase. Include: overview, architecture, main components, API reference, setup instructions, and usage examples.",
      bugs: "Find potential bugs and issues in this codebase. Look for: logic errors, edge cases, race conditions, memory leaks, exception handling issues, and other common bugs.",
      general: "Provide a comprehensive analysis of this codebase. Include: purpose, structure, key components, quality assessment, and suggestions for improvement.",
    };

    const task = analysisPrompts[analysis_type] || analysisPrompts.general;

    // Use RLM tool with codebase context
    return rlmTool.execute(
      {
        task,
        strategy: "map-reduce",
        context_type: "codebase",
        codebase_path: codePath,
        ...(file_extensions && {
          extensions: file_extensions,
        }),
      },
      toolContext
    );
  },
};
