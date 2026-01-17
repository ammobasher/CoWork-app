"use client";

import { useState } from "react";
import {
    FileText,
    Image as ImageIcon,
    Code,
    File,
    Trash2,
    Download,
    Search,
    FolderOpen,
    X
} from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFileStore } from "@/stores";

// File type icons
const fileTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    image: ImageIcon,
    code: Code,
    document: FileText,
    default: File,
};

function getFileType(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.includes("javascript") || mimeType.includes("typescript") ||
        mimeType.includes("python") || mimeType.includes("json") ||
        mimeType.includes("html") || mimeType.includes("css")) return "code";
    if (mimeType.includes("text") || mimeType.includes("pdf") ||
        mimeType.includes("document")) return "document";
    return "default";
}

function getFileTypeColor(type: string): string {
    switch (type) {
        case "image": return "text-emerald-400";
        case "code": return "text-violet-400";
        case "document": return "text-blue-400";
        default: return "text-gray-400";
    }
}

interface FileManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FileManager({ isOpen, onClose }: FileManagerProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const { files, removeFile } = useFileStore();

    const filteredFiles = files.filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownload = (file: { name: string; dataUrl?: string }) => {
        if (file.dataUrl) {
            const link = document.createElement("a");
            link.href = file.dataUrl;
            link.download = file.name;
            link.click();
        }
    };

    const handleDelete = (fileId: string) => {
        removeFile(fileId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={cn(
                "relative w-full max-w-2xl h-[80vh] md:h-[600px]",
                "bg-gradient-to-br from-gray-900 to-gray-950",
                "border border-white/10 rounded-2xl shadow-2xl",
                "flex flex-col overflow-hidden",
                "animate-slide-in-right"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/20">
                            <FolderOpen className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">File Manager</h2>
                            <p className="text-xs text-white/50">{files.length} files</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-white/50 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <Input
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 focus:border-violet-500/50"
                        />
                    </div>
                </div>

                {/* File List */}
                <ScrollArea className="flex-1">
                    {filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <div className="p-4 rounded-full bg-white/5 mb-4">
                                <FolderOpen className="w-8 h-8 text-white/30" />
                            </div>
                            <p className="text-white/50">
                                {searchQuery ? "No files match your search" : "No files uploaded yet"}
                            </p>
                            <p className="text-sm text-white/30 mt-1">
                                Upload files in chat to see them here
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {filteredFiles.map((file) => {
                                const fileType = getFileType(file.type);
                                const IconComponent = fileTypeIcons[fileType] || fileTypeIcons.default;
                                const colorClass = getFileTypeColor(fileType);

                                return (
                                    <div
                                        key={file.id}
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl",
                                            "hover:bg-white/5 transition-colors"
                                        )}
                                    >
                                        {/* Thumbnail / Icon */}
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center",
                                            "bg-white/5 shrink-0 overflow-hidden"
                                        )}>
                                            {file.thumbnail ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={file.thumbnail}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <IconComponent className={cn("w-5 h-5", colorClass)} />
                                            )}
                                        </div>

                                        {/* File info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-white/40">
                                                {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDownload(file)}
                                                className="w-8 h-8 text-white/50 hover:text-white"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(file.id)}
                                                className="w-8 h-8 text-white/50 hover:text-red-400"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <p className="text-xs text-white/40 text-center">
                        Files are stored locally in your browser
                    </p>
                </div>
            </div>
        </div>
    );
}
