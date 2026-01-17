import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Message, Conversation, Artifact, Settings, AIProvider, Project, ToolCall } from "@/types";

// Project Store
interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;

    createProject: (name: string, description?: string) => string;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
    setActiveProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            projects: [],
            activeProjectId: null,

            createProject: (name, description) => {
                const id = crypto.randomUUID();
                const project: Project = {
                    id,
                    name,
                    description,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                set((state) => ({
                    projects: [project, ...state.projects],
                    activeProjectId: id,
                }));

                return id;
            },

            updateProject: (id, updates) => {
                set((state) => ({
                    projects: state.projects.map((p) =>
                        p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
                    ),
                }));
            },

            deleteProject: (id) => {
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                    activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
                }));
            },

            setActiveProject: (id) => set({ activeProjectId: id }),
        }),
        { name: "cowork-projects" }
    )
);

// Conversation Store
interface ConversationState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Record<string, Message[]>;

    // Actions
    createConversation: (title?: string, projectId?: string) => string;
    setActiveConversation: (id: string | null) => void;
    updateConversation: (id: string, updates: Partial<Conversation>) => void;
    deleteConversation: (id: string) => void;
    addMessage: (conversationId: string, message: Message) => void;
    updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
    clearMessages: (conversationId: string) => void;
    exportConversation: (conversationId: string) => string;
    getConversationsByProject: (projectId: string | null) => Conversation[];
}

export const useConversationStore = create<ConversationState>()(
    persist(
        (set, get) => ({
            conversations: [],
            activeConversationId: null,
            messages: {},

            createConversation: (title = "New Conversation", projectId) => {
                const id = crypto.randomUUID();
                const conversation: Conversation = {
                    id,
                    projectId,
                    title,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                set((state) => ({
                    conversations: [conversation, ...state.conversations],
                    activeConversationId: id,
                    messages: { ...state.messages, [id]: [] },
                }));

                return id;
            },

            setActiveConversation: (id) => {
                set({ activeConversationId: id });
            },

            updateConversation: (id, updates) => {
                set((state) => ({
                    conversations: state.conversations.map((c) =>
                        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
                    ),
                }));
            },

            deleteConversation: (id) => {
                set((state) => {
                    const newConversations = state.conversations.filter((c) => c.id !== id);
                    const newMessages = { ...state.messages };
                    delete newMessages[id];

                    return {
                        conversations: newConversations,
                        messages: newMessages,
                        activeConversationId:
                            state.activeConversationId === id
                                ? newConversations[0]?.id || null
                                : state.activeConversationId,
                    };
                });
            },

            addMessage: (conversationId, message) => {
                set((state) => ({
                    messages: {
                        ...state.messages,
                        [conversationId]: [...(state.messages[conversationId] || []), message],
                    },
                }));
            },

            updateMessage: (conversationId, messageId, updates) => {
                set((state) => ({
                    messages: {
                        ...state.messages,
                        [conversationId]: (state.messages[conversationId] || []).map((m) =>
                            m.id === messageId ? { ...m, ...updates } : m
                        ),
                    },
                }));
            },

            clearMessages: (conversationId) => {
                set((state) => ({
                    messages: { ...state.messages, [conversationId]: [] },
                }));
            },

            exportConversation: (conversationId) => {
                const state = get();
                const conversation = state.conversations.find((c) => c.id === conversationId);
                const conversationMessages = state.messages[conversationId] || [];

                if (!conversation) return "";

                const exportData = {
                    title: conversation.title,
                    exportedAt: new Date().toISOString(),
                    messages: conversationMessages.map((m) => ({
                        role: m.role,
                        content: m.content,
                        timestamp: m.createdAt,
                    })),
                };

                return JSON.stringify(exportData, null, 2);
            },

            getConversationsByProject: (projectId) => {
                const state = get();
                if (projectId === null) {
                    return state.conversations.filter((c) => !c.projectId);
                }
                return state.conversations.filter((c) => c.projectId === projectId);
            },
        }),
        {
            name: "cowork-conversations",
            partialize: (state) => ({
                conversations: state.conversations,
                messages: state.messages,
            }),
        }
    )
);

// Tool Calls Store - for visualization
interface ToolCallState {
    toolCalls: ToolCall[];
    addToolCall: (toolCall: ToolCall) => void;
    updateToolCall: (id: string, updates: Partial<ToolCall>) => void;
    clearToolCalls: () => void;
}

export const useToolCallStore = create<ToolCallState>()((set) => ({
    toolCalls: [],

    addToolCall: (toolCall) => {
        set((state) => ({
            toolCalls: [...state.toolCalls, toolCall],
        }));
    },

    updateToolCall: (id, updates) => {
        set((state) => ({
            toolCalls: state.toolCalls.map((tc) =>
                tc.id === id ? { ...tc, ...updates } : tc
            ),
        }));
    },

    clearToolCalls: () => set({ toolCalls: [] }),
}));

// Artifact Store
interface ArtifactState {
    artifacts: Artifact[];
    activeArtifactId: string | null;
    isPanelOpen: boolean;

    addArtifact: (artifact: Artifact) => void;
    updateArtifact: (id: string, updates: Partial<Artifact>) => void;
    setActiveArtifact: (id: string | null) => void;
    togglePanel: () => void;
    openPanel: () => void;
    closePanel: () => void;
    clearArtifacts: () => void;
}

export const useArtifactStore = create<ArtifactState>()((set) => ({
    artifacts: [],
    activeArtifactId: null,
    isPanelOpen: false,

    addArtifact: (artifact) => {
        set((state) => ({
            artifacts: [...state.artifacts, artifact],
            activeArtifactId: artifact.id,
            isPanelOpen: true,
        }));
    },

    updateArtifact: (id, updates) => {
        set((state) => ({
            artifacts: state.artifacts.map((a) =>
                a.id === id ? { ...a, ...updates, version: a.version + 1 } : a
            ),
        }));
    },

    setActiveArtifact: (id) => {
        set({ activeArtifactId: id, isPanelOpen: id !== null });
    },

    togglePanel: () => {
        set((state) => ({ isPanelOpen: !state.isPanelOpen }));
    },

    openPanel: () => set({ isPanelOpen: true }),
    closePanel: () => set({ isPanelOpen: false }),
    clearArtifacts: () => set({ artifacts: [], activeArtifactId: null }),
}));

// Settings Store
interface SettingsState {
    settings: Settings;
    apiKeys: Record<AIProvider, string>;
    activeModel: string;

    updateSettings: (updates: Partial<Settings>) => void;
    setApiKey: (provider: AIProvider, key: string) => void;
    setActiveModel: (model: string) => void;
    getResolvedTheme: () => "light" | "dark";
}

const defaultSettings: Settings = {
    theme: "dark",
    aiProvider: "gemini",
    aiModel: "gemini-2.0-flash-exp",
    fontSize: "medium",
    showLineNumbers: true,
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            settings: defaultSettings,
            apiKeys: { gemini: "", openai: "", anthropic: "" },
            activeModel: "gemini-2.0-flash-exp",

            updateSettings: (updates) => {
                set((state) => ({
                    settings: { ...state.settings, ...updates },
                }));
            },

            setApiKey: (provider, key) => {
                set((state) => ({
                    apiKeys: { ...state.apiKeys, [provider]: key },
                }));
            },

            setActiveModel: (model) => {
                set({ activeModel: model });
            },

            getResolvedTheme: () => {
                const { settings } = get();
                if (settings.theme === "system") {
                    if (typeof window !== "undefined") {
                        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                    }
                    return "dark";
                }
                return settings.theme;
            },
        }),
        {
            name: "cowork-settings",
        }
    )
);

// UI State Store
interface UIState {
    isSidebarOpen: boolean;
    isSettingsOpen: boolean;
    isLoading: boolean;
    error: string | null;
    streamingMessageId: string | null;
    isExportModalOpen: boolean;
    isProjectModalOpen: boolean;
    isFileManagerOpen: boolean;

    toggleSidebar: () => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStreamingMessageId: (id: string | null) => void;
    openExportModal: () => void;
    closeExportModal: () => void;
    openProjectModal: () => void;
    closeProjectModal: () => void;
    openFileManager: () => void;
    closeFileManager: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
    isSidebarOpen: true,
    isSettingsOpen: false,
    isLoading: false,
    error: null,
    streamingMessageId: null,
    isExportModalOpen: false,
    isProjectModalOpen: false,
    isFileManagerOpen: false,

    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    openSidebar: () => set({ isSidebarOpen: true }),
    closeSidebar: () => set({ isSidebarOpen: false }),
    openSettings: () => set({ isSettingsOpen: true }),
    closeSettings: () => set({ isSettingsOpen: false }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setStreamingMessageId: (id) => set({ streamingMessageId: id }),
    openExportModal: () => set({ isExportModalOpen: true }),
    closeExportModal: () => set({ isExportModalOpen: false }),
    openProjectModal: () => set({ isProjectModalOpen: true }),
    closeProjectModal: () => set({ isProjectModalOpen: false }),
    openFileManager: () => set({ isFileManagerOpen: true }),
    closeFileManager: () => set({ isFileManagerOpen: false }),
}));

// File Store - for file management
interface StoredFile {
    id: string;
    name: string;
    type: string;
    size: number;
    thumbnail?: string;
    dataUrl?: string;
    conversationId?: string;
    createdAt: Date;
}

interface FileState {
    files: StoredFile[];
    addFile: (file: StoredFile) => void;
    removeFile: (id: string) => void;
    getFilesByConversation: (conversationId: string) => StoredFile[];
    clearFiles: () => void;
}

export const useFileStore = create<FileState>()(
    persist(
        (set, get) => ({
            files: [],

            addFile: (file) => {
                set((state) => ({
                    files: [file, ...state.files],
                }));
            },

            removeFile: (id) => {
                set((state) => ({
                    files: state.files.filter((f) => f.id !== id),
                }));
            },

            getFilesByConversation: (conversationId) => {
                return get().files.filter((f) => f.conversationId === conversationId);
            },

            clearFiles: () => set({ files: [] }),
        }),
        {
            name: "cowork-files",
            partialize: (state) => ({
                // Only persist file metadata, not full data URLs for storage efficiency
                files: state.files.map((f) => ({
                    ...f,
                    dataUrl: undefined, // Don't persist large data URLs
                    thumbnail: f.thumbnail, // Keep thumbnails as they're small
                })),
            }),
        }
    )
);

