"use client";

import { useCallback, useEffect } from "react";
import { Menu, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ArtifactPanel } from "@/components/artifacts/ArtifactPanel";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { ExportModal } from "@/components/layout/ExportModal";
import { ProjectModal } from "@/components/layout/ProjectModal";
import { FileManager } from "@/components/layout/FileManager";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/hooks/useTheme";
import {
  useConversationStore,
  useSettingsStore,
  useUIStore,
  useArtifactStore,
  useProjectStore,
} from "@/stores";
import { Message } from "@/types";
import { cn } from "@/lib/utils";

export default function Home() {
  // Initialize hooks
  useKeyboardShortcuts();
  const theme = useTheme();

  const {
    conversations,
    activeConversationId,
    messages,
    createConversation,
    addMessage,
    updateMessage,
    updateConversation,
  } = useConversationStore();
  const { activeProjectId } = useProjectStore();
  const { settings, apiKeys, activeModel } = useSettingsStore();
  const { isLoading, setLoading, streamingMessageId, setStreamingMessageId, setError, openSidebar, isFileManagerOpen, closeFileManager } =
    useUIStore();
  const { addArtifact } = useArtifactStore();

  const activeMessages = activeConversationId
    ? messages[activeConversationId] || []
    : [];

  // Create a new conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation(undefined, activeProjectId || undefined);
    }
  }, [conversations.length, createConversation, activeProjectId]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (!activeConversationId) return;

      const apiKey = apiKeys[settings.aiProvider];
      if (!apiKey) {
        setError("Please configure your API key in settings (⌘,)");
        return;
      }

      // Create user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId,
        role: "user",
        content,
        files: files?.map((f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          type: f.type,
          size: f.size,
          path: "",
          createdAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addMessage(activeConversationId, userMessage);

      // Update conversation title if first message
      if (activeMessages.length === 0) {
        const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        updateConversation(activeConversationId, { title });
      }

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addMessage(activeConversationId, assistantMessage);
      setLoading(true);
      setStreamingMessageId(assistantMessage.id);

      try {
        // Prepare messages for API - include system prompt for tool usage
        const systemPrompt = `You are CoWork, an autonomous AI coding agent. You have access to tools and MUST use them immediately when the user asks for actions.

CRITICAL RULES:
1. NEVER ask for clarification or permission - just use tools immediately
2. NEVER describe what you "would" do - actually DO it by calling tools
3. When asked to list files, IMMEDIATELY call list_directory with path "."
4. When asked about "current directory" or "this directory", use path "."
5. When asked to read a file, IMMEDIATELY call read_file
6. When asked to search, IMMEDIATELY call grep or search_files
7. When asked to run a command, IMMEDIATELY call run_command

The workspace root is the current directory ("."). Use "." as the default path for any file or directory operations.

Available tools:
- list_directory: path="." for current directory
- read_file: Read file contents
- write_file: Write to files
- search_files: Find files by pattern
- grep: Search content in files
- run_command: Execute shell commands
- create_artifact: Display code/content
- execute_python: Run Python code
- execute_javascript: Run JavaScript code

You are an AGENT - you take action, you don't ask questions. If the user says "list files", you call list_directory immediately. No exceptions.`;

        const apiMessages = [
          { role: "system", content: systemPrompt },
          ...activeMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content },
        ];

        // Call streaming API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            provider: settings.aiProvider,
            model: activeModel,
            apiKey,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "text") {
                fullContent += data.content;
                updateMessage(activeConversationId, assistantMessage.id, {
                  content: fullContent,
                });
              } else if (data.type === "tool_call") {
                // Show tool call in the message
                const toolInfo = `\n🔧 **Calling tool:** \`${data.name}\`\n`;
                fullContent += toolInfo;
                updateMessage(activeConversationId, assistantMessage.id, {
                  content: fullContent,
                });
              } else if (data.type === "tool_result") {
                // Show tool result in the message - format nicely
                let resultStr: string;
                const result = data.result;

                try {
                  // Handle different result types properly
                  if (typeof result === 'string') {
                    resultStr = result;
                  } else if (result === null || result === undefined) {
                    resultStr = 'null';
                  } else {
                    // Deep stringify with proper indentation
                    resultStr = JSON.stringify(result, null, 2);
                  }
                } catch (e) {
                  resultStr = `Error serializing result: ${e}`;
                }

                // For list_directory, format more nicely
                if (data.name === 'list_directory' && result?.entries) {
                  const entries = result.entries;
                  const fileList = entries.map((e: { name: string; type: string; size?: number }) =>
                    `${e.type === 'directory' ? '📁' : '📄'} ${e.name}${e.size ? ` (${e.size} bytes)` : ''}`
                  ).join('\n');
                  resultStr = `Found ${entries.length} items:\n${fileList}`;
                }

                // For read_file, show content with preview
                if (data.name === 'read_file' && result?.content) {
                  const content = result.content;
                  resultStr = content.length > 1000
                    ? `${content.substring(0, 1000)}...\n\n(${content.length} characters total)`
                    : content;
                }

                // For write_file/edit_file, show friendly success message
                if ((data.name === 'write_file' || data.name === 'edit_file') && result?.success) {
                  resultStr = `✅ ${result.message || 'Operation completed successfully'}`;
                  if (result.path) resultStr += `\nPath: ${result.path}`;
                  if (result.bytesWritten) resultStr += `\nBytes written: ${result.bytesWritten}`;
                }

                const resultInfo = `\n📋 **Result from \`${data.name}\`:**\n\`\`\`\n${resultStr}\n\`\`\`\n`;
                fullContent += resultInfo;
                updateMessage(activeConversationId, assistantMessage.id, {
                  content: fullContent,
                });
              } else if (data.type === "compaction") {
                // Show compaction notification in the message
                const compactionInfo = `\n💫 *Context optimized: ${data.original_tokens.toLocaleString()} → ${data.compacted_tokens.toLocaleString()} tokens*\n`;
                fullContent += compactionInfo;
                updateMessage(activeConversationId, assistantMessage.id, {
                  content: fullContent,
                });
              } else if (data.type === "error") {
                throw new Error(data.error);
              } else if (data.type === "artifact") {
                const artifact = {
                  id: crypto.randomUUID(),
                  messageId: assistantMessage.id,
                  type: data.artifact.type,
                  title: data.artifact.title,
                  content: data.artifact.content,
                  language: data.artifact.language,
                  version: 1,
                  createdAt: new Date(),
                };
                addArtifact(artifact);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }

        // Extract code blocks as artifacts
        extractArtifacts(fullContent, assistantMessage.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        updateMessage(activeConversationId, assistantMessage.id, {
          content: `Error: ${errorMessage}`,
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
        setStreamingMessageId(null);
      }
    },
    [
      activeConversationId,
      activeMessages,
      activeModel,
      apiKeys,
      settings.aiProvider,
      addMessage,
      updateMessage,
      updateConversation,
      setLoading,
      setError,
      setStreamingMessageId,
      addArtifact,
    ]
  );

  // Extract code blocks from response and create artifacts
  const extractArtifacts = (content: string, messageId: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || "text";
      const code = match[2].trim();

      if (code.length > 50) {
        const artifact = {
          id: crypto.randomUUID(),
          messageId,
          type: "code" as const,
          title: `Code ${index + 1}`,
          content: code,
          language,
          version: 1,
          createdAt: new Date(),
        };
        addArtifact(artifact);
        index++;
      }
    }
  };

  return (
    <ToastProvider>
      <TooltipProvider>
        <div
          className={cn(
            "flex h-screen overflow-hidden transition-colors duration-300",
            theme === "dark"
              ? "bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"
              : "bg-gradient-to-br from-gray-100 via-white to-gray-100"
          )}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className={cn(
                "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px]",
                theme === "dark" ? "bg-violet-600/20" : "bg-violet-400/20"
              )}
            />
            <div
              className={cn(
                "absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-[100px]",
                theme === "dark" ? "bg-indigo-600/20" : "bg-indigo-400/20"
              )}
            />
          </div>

          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="relative flex-1 flex flex-col min-w-0 transition-all duration-300">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center gap-3 p-4 border-b border-white/5">
              <Button
                variant="ghost"
                size="icon"
                onClick={openSidebar}
                className="h-8 w-8"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-white">CoWork</span>
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={activeMessages}
              streamingMessageId={streamingMessageId}
            />

            {/* Input */}
            <MessageInput onSend={handleSendMessage} isLoading={isLoading} />
          </main>

          {/* Artifact Panel */}
          <ArtifactPanel />

          {/* Modals */}
          <SettingsDialog />
          <ExportModal />
          <ProjectModal />
          <FileManager isOpen={isFileManagerOpen} onClose={closeFileManager} />
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
}

