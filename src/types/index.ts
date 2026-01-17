// Message types
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    artifacts?: Artifact[];
    toolCalls?: ToolCall[];
    files?: FileReference[];
    createdAt: Date;
    updatedAt: Date;
}

// Artifact types
export type ArtifactType = "code" | "markdown" | "html" | "image" | "mermaid" | "react";

export interface Artifact {
    id: string;
    messageId: string;
    type: ArtifactType;
    title: string;
    content: string;
    language?: string;
    version: number;
    createdAt: Date;
}

// Tool types
export type ToolStatus = "pending" | "running" | "success" | "error";

export interface ToolCall {
    id: string;
    messageId: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: ToolStatus;
    startedAt: Date;
    completedAt?: Date;
}

// File types
export interface FileReference {
    id: string;
    name: string;
    type: string;
    size: number;
    path: string;
    createdAt: Date;
}

// Conversation types
export interface Conversation {
    id: string;
    projectId?: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

// Project types
export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

// AI Provider types
export type AIProvider = "gemini" | "openai" | "anthropic";

export interface AIConfig {
    provider: AIProvider;
    model: string;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface StreamChunk {
    type: "text" | "tool_call" | "artifact" | "error" | "done";
    content?: string;
    toolCall?: Partial<ToolCall>;
    artifact?: Partial<Artifact>;
    error?: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
    files?: FileReference[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

// Settings types
export interface Settings {
    theme: "light" | "dark" | "system";
    aiProvider: AIProvider;
    aiModel: string;
    fontSize: "small" | "medium" | "large";
    showLineNumbers: boolean;
}
