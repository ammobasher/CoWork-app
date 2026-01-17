"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    MessageSquare,
    Trash2,
    MoreHorizontal,
    FolderOpen,
    Settings,
    ChevronLeft,
    Sparkles,
    Download,
    Folder,
    Sun,
    Moon,
    Keyboard,
    FileStack,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConversationStore, useUIStore, useSettingsStore, useProjectStore } from "@/stores";
import { cn, truncate, formatDate } from "@/lib/utils";

export function Sidebar() {
    const [searchQuery, setSearchQuery] = useState("");
    const { isSidebarOpen, toggleSidebar, closeSidebar, openSettings, openExportModal, openProjectModal, openFileManager } = useUIStore();
    const { settings, updateSettings } = useSettingsStore();
    const { projects, activeProjectId } = useProjectStore();
    const {
        conversations,
        activeConversationId,
        createConversation,
        setActiveConversation,
        deleteConversation,
    } = useConversationStore();

    // Filter conversations by project and search
    const filteredConversations = conversations
        .filter((c) => {
            if (activeProjectId === null) return true; // Show all when no project selected
            return c.projectId === activeProjectId;
        })
        .filter((c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const activeProject = projects.find((p) => p.id === activeProjectId);

    const toggleTheme = () => {
        const newTheme = settings.theme === "dark" ? "light" : "dark";
        updateSettings({ theme: newTheme });
    };

    return (
        <TooltipProvider>
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
                    onClick={closeSidebar}
                />
            )}
            <div
                className={cn(
                    "relative flex flex-col h-full border-r z-50",
                    "bg-gradient-to-b from-gray-900/50 to-gray-950/50 dark:from-gray-900/50 dark:to-gray-950/50",
                    "light:from-gray-100/80 light:to-gray-50/80 light:border-gray-200",
                    "border-white/5 dark:border-white/5",
                    "transition-all duration-300 ease-in-out",
                    // Desktop: normal sidebar behavior
                    "md:relative md:translate-x-0",
                    isSidebarOpen ? "w-72" : "w-0 md:w-0 border-r-0",
                    // Mobile: full height fixed overlay
                    "fixed md:static inset-y-0 left-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                {/* Container for sidebar content */}
                <div
                    className={cn(
                        "absolute inset-0 flex flex-col overflow-hidden",
                        "transition-opacity duration-200",
                        isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-white dark:text-white">CoWork</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={toggleTheme}
                                        className="h-8 w-8"
                                    >
                                        {settings.theme === "dark" ? (
                                            <Sun className="w-4 h-4" />
                                        ) : (
                                            <Moon className="w-4 h-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Toggle theme</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={toggleSidebar}
                                        className="h-8 w-8"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Hide sidebar (⌘B)</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Project indicator */}
                    <button
                        onClick={openProjectModal}
                        className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <Folder className="w-4 h-4 text-violet-400" />
                        <span className="text-sm text-white/70 flex-1 text-left truncate">
                            {activeProject ? activeProject.name : "All Conversations"}
                        </span>
                        <FolderOpen className="w-4 h-4 text-white/40" />
                    </button>

                    {/* New Chat Button */}
                    <div className="p-3">
                        <Button
                            onClick={() => createConversation(undefined, activeProjectId || undefined)}
                            className="w-full justify-start gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New Conversation
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="px-3 pb-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <Input
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Conversations List */}
                    <ScrollArea className="flex-1 px-2">
                        <div className="space-y-1 pb-4">
                            {filteredConversations.length === 0 ? (
                                <div className="text-center py-8 text-white/40 text-sm">
                                    {searchQuery
                                        ? "No conversations found"
                                        : "No conversations yet"}
                                </div>
                            ) : (
                                filteredConversations.map((conversation) => (
                                    <div
                                        key={conversation.id}
                                        className={cn(
                                            "group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                                            conversation.id === activeConversationId
                                                ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30"
                                                : "hover:bg-white/5 border border-transparent"
                                        )}
                                        onClick={() => setActiveConversation(conversation.id)}
                                    >
                                        <MessageSquare
                                            className={cn(
                                                "w-4 h-4 shrink-0",
                                                conversation.id === activeConversationId
                                                    ? "text-violet-400"
                                                    : "text-white/40"
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className={cn(
                                                    "text-sm font-medium truncate",
                                                    conversation.id === activeConversationId
                                                        ? "text-white"
                                                        : "text-white/70"
                                                )}
                                            >
                                                {truncate(conversation.title, 25)}
                                            </p>
                                            <p className="text-xs text-white/30 truncate">
                                                {formatDate(conversation.updatedAt)}
                                            </p>
                                        </div>

                                        {/* Actions dropdown */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-7 w-7 shrink-0",
                                                        "opacity-0 group-hover:opacity-100 transition-opacity"
                                                    )}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveConversation(conversation.id);
                                                        openExportModal();
                                                    }}
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Export
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-400 focus:text-red-300"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteConversation(conversation.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="p-3 border-t border-white/5 space-y-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-white/60"
                            onClick={openFileManager}
                        >
                            <FileStack className="w-4 h-4" />
                            Files
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-white/60"
                            onClick={openSettings}
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                            <span className="ml-auto text-xs text-white/30">⌘,</span>
                        </Button>
                        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-white/30">
                            <span className="flex items-center gap-1">
                                <Keyboard className="w-3 h-3" />
                                ⌘B sidebar
                            </span>
                            <span>⌘N new</span>
                        </div>
                    </div>
                </div>

                {/* Collapsed toggle button */}
                {!isSidebarOpen && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleSidebar}
                                className="absolute top-4 -right-12 h-8 w-8"
                            >
                                <ChevronLeft className="w-4 h-4 rotate-180" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Show sidebar (⌘B)</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}
