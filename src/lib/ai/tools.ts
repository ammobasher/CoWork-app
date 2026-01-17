import { toolRegistry, Tool } from "./types";
import { executePythonCode, executeJavaScriptCode } from "../sandbox";

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
        return await executeJavaScriptCode(code);
    },
};

// Read File Tool
const readFileTool: Tool = {
    definition: {
        name: "read_file",
        description: "Read the contents of an uploaded file",
        parameters: {
            type: "object",
            properties: {
                fileId: {
                    type: "string",
                    description: "The ID of the file to read",
                },
            },
            required: ["fileId"],
        },
    },
    execute: async (args) => {
        // File reading is handled by the API route
        return { fileId: args.fileId, status: "pending" };
    },
};

// Web Search Tool (mock for now)
const webSearchTool: Tool = {
    definition: {
        name: "web_search",
        description: "Search the web for information (mock implementation)",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query",
                },
            },
            required: ["query"],
        },
    },
    execute: async (args) => {
        const { query } = args as { query: string };
        // Mock response - can be replaced with actual search API
        return {
            query,
            results: [
                {
                    title: `Search results for: ${query}`,
                    snippet: "This is a mock search result. Web search functionality can be extended with APIs like Serper, Tavily, or SerpAPI.",
                    url: "https://example.com",
                },
            ],
        };
    },
};

/**
 * Register all built-in tools
 */
export function registerBuiltinTools(): void {
    toolRegistry.register(createArtifactTool);
    toolRegistry.register(executePythonTool);
    toolRegistry.register(executeJavaScriptTool);
    toolRegistry.register(readFileTool);
    toolRegistry.register(webSearchTool);
}

export { toolRegistry };
