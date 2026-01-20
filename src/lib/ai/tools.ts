import { toolRegistry, Tool, ToolContext } from "./types";

// Import all tools from the tools directory
import {
    generateImageTool,
    analyzeImageTool,
} from "./tools/image";
import {
    webSearchTool,
    readUrlTool,
} from "./tools/search";
import {
    readFileTool,
    writeFileTool,
    listDirectoryTool,
    searchFilesTool,
} from "./tools/filesystem";
import {
    runCommandTool,
    runNpmScriptTool,
    gitTool,
} from "./tools/terminal";
import {
    editFileTool,
    multiEditTool,
    insertLineTool,
} from "./tools/edit";
import {
    grepTool,
    findFileTool,
} from "./tools/grep";
import {
    batchRenameTool,
    batchDeleteTool,
    batchCopyTool,
} from "./tools/batch";
import {
    rlmTool,
    analyzeCodebaseTool,
} from "./tools/rlm";

/**
 * Built-in tools for the AI
 */

// Create Artifact Tool
const createArtifactTool: Tool = {
    definition: {
        name: "create_artifact",
        description: "Create or update an artifact (code, document, diagram, etc.) that will be displayed in the artifact panel. Use this when you need to show the user structured content like code files, markdown documents, mermaid diagrams, or HTML previews.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "A short, descriptive title for the artifact",
                },
                type: {
                    type: "string",
                    enum: ["code", "markdown", "html", "mermaid", "react"],
                    description: "The type of artifact",
                },
                content: {
                    type: "string",
                    description: "The content of the artifact",
                },
                language: {
                    type: "string",
                    description: "Programming language for code artifacts (e.g., python, javascript, typescript)",
                },
            },
            required: ["title", "type", "content"],
        },
    },
    execute: async (args) => {
        // Artifact creation is handled by the message processor
        return { success: true, artifact: args };
    },
};

// Execute Python Code Tool
const executePythonTool: Tool = {
    definition: {
        name: "execute_python",
        description: "Execute Python code in a sandboxed environment. Returns the output (stdout, stderr) and any errors. Use this to run computations, data processing, or demonstrate Python code.",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description: "The Python code to execute",
                },
            },
            required: ["code"],
        },
    },
    execute: async (args) => {
        const { code } = args as { code: string };
        // Dynamic import to avoid Turbopack issues with child_process
        const { executePythonCode } = await import("../sandbox");
        return await executePythonCode(code);
    },
};

// Execute JavaScript Code Tool
const executeJavaScriptTool: Tool = {
    definition: {
        name: "execute_javascript",
        description: "Execute JavaScript code in a sandboxed environment. Returns the output and any errors. Use this to run computations, demonstrate JS code, or process data.",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description: "The JavaScript code to execute",
                },
            },
            required: ["code"],
        },
    },
    execute: async (args) => {
        const { code } = args as { code: string };
        // Dynamic import to avoid Turbopack issues with child_process
        const { executeJavaScriptCode } = await import("../sandbox");
        return await executeJavaScriptCode(code);
    },
};

/**
 * Register all built-in tools
 */
export function registerBuiltinTools(): void {
    // Core tools
    toolRegistry.register(createArtifactTool);
    toolRegistry.register(executePythonTool);
    toolRegistry.register(executeJavaScriptTool);

    // File system tools - Basic
    toolRegistry.register(readFileTool);
    toolRegistry.register(writeFileTool);
    toolRegistry.register(listDirectoryTool);
    toolRegistry.register(searchFilesTool);

    // File system tools - Advanced
    toolRegistry.register(editFileTool);
    toolRegistry.register(multiEditTool);
    toolRegistry.register(insertLineTool);

    // Search tools
    toolRegistry.register(grepTool);
    toolRegistry.register(findFileTool);

    // Batch operations
    toolRegistry.register(batchRenameTool);
    toolRegistry.register(batchDeleteTool);
    toolRegistry.register(batchCopyTool);

    // Terminal tools
    toolRegistry.register(runCommandTool);
    toolRegistry.register(runNpmScriptTool);
    toolRegistry.register(gitTool);

    // Web tools
    toolRegistry.register(webSearchTool);
    toolRegistry.register(readUrlTool);

    // Image tools
    toolRegistry.register(generateImageTool);
    toolRegistry.register(analyzeImageTool);

    // RLM tools
    toolRegistry.register(rlmTool);
    toolRegistry.register(analyzeCodebaseTool);
}

export { toolRegistry } from "./types";
export type { ToolContext } from "./types";
