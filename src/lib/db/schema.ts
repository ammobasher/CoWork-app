import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Projects table
export const projects = sqliteTable("projects", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Conversations table
export const conversations = sqliteTable("conversations", {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    title: text("title").notNull().default("New Conversation"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Messages table
export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Artifacts table
export const artifacts = sqliteTable("artifacts", {
    id: text("id").primaryKey(),
    messageId: text("message_id")
        .notNull()
        .references(() => messages.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["code", "markdown", "html", "image", "mermaid", "react"] }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    language: text("language"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Files table
export const files = sqliteTable("files", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});

// Tool calls table
export const toolCalls = sqliteTable("tool_calls", {
    id: text("id").primaryKey(),
    messageId: text("message_id")
        .notNull()
        .references(() => messages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    arguments: text("arguments", { mode: "json" }),
    result: text("result", { mode: "json" }),
    status: text("status", { enum: ["pending", "running", "success", "error"] }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Settings table (key-value store)
export const settings = sqliteTable("settings", {
    key: text("key").primaryKey(),
    value: text("value", { mode: "json" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .$defaultFn(() => new Date()),
});
