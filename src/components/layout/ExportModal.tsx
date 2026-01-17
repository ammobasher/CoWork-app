"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check, FileJson, FileText, FileCode } from "lucide-react";
import { useUIStore, useConversationStore } from "@/stores";
import { cn } from "@/lib/utils";

type ExportFormat = "json" | "markdown" | "text";

export function ExportModal() {
    const { isExportModalOpen, closeExportModal } = useUIStore();
    const { activeConversationId, conversations, messages } = useConversationStore();
    const [format, setFormat] = useState<ExportFormat>("json");
    const [copied, setCopied] = useState(false);

    const conversation = conversations.find((c) => c.id === activeConversationId);
    const conversationMessages = activeConversationId
        ? messages[activeConversationId] || []
        : [];

    const generateExport = (): string => {
        if (!conversation) return "";

        switch (format) {
            case "json":
                return JSON.stringify(
                    {
                        title: conversation.title,
                        exportedAt: new Date().toISOString(),
                        messages: conversationMessages.map((m) => ({
                            role: m.role,
                            content: m.content,
                            timestamp: m.createdAt,
                        })),
                    },
                    null,
                    2
                );

            case "markdown":
                let md = `# ${conversation.title}\n\n`;
                md += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
                conversationMessages.forEach((m) => {
                    const role = m.role === "user" ? "**You**" : "**Assistant**";
                    md += `${role}\n\n${m.content}\n\n---\n\n`;
                });
                return md;

            case "text":
                let txt = `${conversation.title}\n`;
                txt += `Exported: ${new Date().toLocaleString()}\n`;
                txt += "=".repeat(50) + "\n\n";
                conversationMessages.forEach((m) => {
                    const role = m.role === "user" ? "You:" : "Assistant:";
                    txt += `${role}\n${m.content}\n\n`;
                    txt += "-".repeat(30) + "\n\n";
                });
                return txt;
        }
    };

    const handleCopy = async () => {
        const content = generateExport();
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const content = generateExport();
        const extensions: Record<ExportFormat, string> = {
            json: "json",
            markdown: "md",
            text: "txt",
        };
        const mimeTypes: Record<ExportFormat, string> = {
            json: "application/json",
            markdown: "text/markdown",
            text: "text/plain",
        };

        const blob = new Blob([content], { type: mimeTypes[format] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${conversation?.title || "conversation"}.${extensions[format]}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formats: { id: ExportFormat; name: string; icon: React.ReactNode }[] = [
        { id: "json", name: "JSON", icon: <FileJson className="w-4 h-4" /> },
        { id: "markdown", name: "Markdown", icon: <FileCode className="w-4 h-4" /> },
        { id: "text", name: "Plain Text", icon: <FileText className="w-4 h-4" /> },
    ];

    return (
        <Dialog open={isExportModalOpen} onOpenChange={closeExportModal}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Export Conversation
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    {/* Format Selection */}
                    <div>
                        <label className="text-sm font-medium text-white/70 mb-2 block">
                            Export Format
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {formats.map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setFormat(f.id)}
                                    className={cn(
                                        "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-200",
                                        format === f.id
                                            ? "border-violet-500/50 bg-violet-500/10 text-white"
                                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                                    )}
                                >
                                    {f.icon}
                                    <span className="text-sm font-medium">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="text-sm font-medium text-white/70 mb-2 block">
                            Preview
                        </label>
                        <pre className="rounded-xl bg-black/30 border border-white/10 p-4 text-xs text-white/60 max-h-48 overflow-auto">
                            {generateExport().slice(0, 500)}
                            {generateExport().length > 500 && "..."}
                        </pre>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={handleCopy}>
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy
                                </>
                            )}
                        </Button>
                        <Button className="flex-1" onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
