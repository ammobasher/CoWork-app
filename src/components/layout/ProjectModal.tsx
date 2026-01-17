"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    FolderPlus,
    Folder,
    Trash2,
    Check,
    Edit2,
} from "lucide-react";
import { useUIStore, useProjectStore } from "@/stores";
import { cn } from "@/lib/utils";

export function ProjectModal() {
    const { isProjectModalOpen, closeProjectModal } = useUIStore();
    const { projects, activeProjectId, createProject, updateProject, deleteProject, setActiveProject } =
        useProjectStore();
    const [newProjectName, setNewProjectName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    const handleCreate = () => {
        if (!newProjectName.trim()) return;
        createProject(newProjectName.trim());
        setNewProjectName("");
    };

    const handleUpdate = (id: string) => {
        if (!editingName.trim()) return;
        updateProject(id, { name: editingName.trim() });
        setEditingId(null);
        setEditingName("");
    };

    const handleDelete = (id: string) => {
        deleteProject(id);
        if (activeProjectId === id) {
            setActiveProject(null);
        }
    };

    const startEditing = (id: string, name: string) => {
        setEditingId(id);
        setEditingName(name);
    };

    return (
        <Dialog open={isProjectModalOpen} onOpenChange={closeProjectModal}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5" />
                        Manage Projects
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    {/* Create new project */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="New project name..."
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        />
                        <Button onClick={handleCreate} disabled={!newProjectName.trim()}>
                            <FolderPlus className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Project list */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {/* All Conversations (no project) */}
                        <button
                            onClick={() => {
                                setActiveProject(null);
                                closeProjectModal();
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                                activeProjectId === null
                                    ? "bg-violet-500/10 border border-violet-500/30"
                                    : "bg-white/5 border border-transparent hover:bg-white/10"
                            )}
                        >
                            <Folder className="w-4 h-4 text-white/60" />
                            <span className="flex-1 text-left text-sm text-white">
                                All Conversations
                            </span>
                            {activeProjectId === null && (
                                <Check className="w-4 h-4 text-violet-400" />
                            )}
                        </button>

                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200",
                                    activeProjectId === project.id
                                        ? "bg-violet-500/10 border border-violet-500/30"
                                        : "bg-white/5 border border-transparent hover:bg-white/10"
                                )}
                            >
                                {editingId === project.id ? (
                                    <>
                                        <Input
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleUpdate(project.id);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                            autoFocus
                                            className="h-8"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleUpdate(project.id)}
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setActiveProject(project.id);
                                                closeProjectModal();
                                            }}
                                            className="flex-1 flex items-center gap-3 text-left"
                                        >
                                            <Folder className="w-4 h-4 text-violet-400" />
                                            <span className="text-sm text-white truncate">
                                                {project.name}
                                            </span>
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {activeProjectId === project.id && (
                                                <Check className="w-4 h-4 text-violet-400 mr-1" />
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                                onClick={() => startEditing(project.id, project.name)}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-red-400 hover:text-red-300"
                                                onClick={() => handleDelete(project.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {projects.length === 0 && (
                            <p className="text-center text-sm text-white/40 py-4">
                                No projects yet. Create one to organize your conversations.
                            </p>
                        )}
                    </div>

                    <p className="text-xs text-white/40 text-center">
                        Projects help you organize conversations by topic or task.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
