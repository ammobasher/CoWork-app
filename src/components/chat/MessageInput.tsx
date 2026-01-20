"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageInputProps {
    onSend: (content: string, files?: File[]) => void;
    isLoading?: boolean;
    placeholder?: string;
}

export function MessageInput({
    onSend,
    isLoading = false,
    placeholder = "Message CoWork...",
}: MessageInputProps) {
    const [content, setContent] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(() => {
        if (!content.trim() && files.length === 0) return;
        if (isLoading) return;

        onSend(content.trim(), files.length > 0 ? files : undefined);
        setContent("");
        setFiles([]);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [content, files, isLoading, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);

        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        setFiles((prev) => [...prev, ...selectedFiles]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        setFiles((prev) => [...prev, ...droppedFiles]);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4 pb-4">
            <div
                className={cn(
                    "relative rounded-2xl border transition-all duration-300",
                    "bg-gradient-to-b from-white/[0.08] to-white/[0.03]",
                    "backdrop-blur-xl shadow-2xl",
                    isDragging
                        ? "border-violet-500/50 shadow-violet-500/20"
                        : "border-white/10 hover:border-white/20"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* File preview */}
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 pb-0">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 text-sm text-white/80"
                            >
                                <span className="truncate max-w-[150px]">{file.name}</span>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="text-white/40 hover:text-white transition-colors"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input area */}
                <div className="flex items-end gap-2 p-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        rows={1}
                        className={cn(
                            "flex-1 resize-none bg-transparent text-white placeholder:text-white/60",
                            "focus:outline-none text-sm leading-relaxed",
                            "min-h-[36px] max-h-[200px] py-2"
                        )}
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-9 w-9"
                    >
                        <Mic className="h-4 w-4" />
                    </Button>

                    <Button
                        size="icon"
                        className="shrink-0 h-9 w-9"
                        onClick={handleSubmit}
                        disabled={isLoading || (!content.trim() && files.length === 0)}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Drag overlay */}
                {isDragging && (
                    <div className="absolute inset-0 rounded-2xl bg-violet-500/10 border-2 border-dashed border-violet-500/50 flex items-center justify-center">
                        <p className="text-violet-400 font-medium">Drop files here</p>
                    </div>
                )}
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-white/60 mt-2">
                Press Enter to send, Shift + Enter for new line
            </p>
        </div>
    );
}
