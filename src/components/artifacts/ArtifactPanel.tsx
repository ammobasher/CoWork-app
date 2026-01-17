"use client";

import { useState, useEffect } from "react";
import { X, Code, FileText, Image as ImageIcon, Maximize2, Minimize2, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useArtifactStore } from "@/stores";
import { cn } from "@/lib/utils";
import { Artifact } from "@/types";

export function ArtifactPanel() {
    const { artifacts, activeArtifactId, isPanelOpen, closePanel, setActiveArtifact } =
        useArtifactStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const activeArtifact = artifacts.find((a) => a.id === activeArtifactId);

    const copyContent = async () => {
        if (!activeArtifact) return;
        await navigator.clipboard.writeText(activeArtifact.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadArtifact = () => {
        if (!activeArtifact) return;
        const blob = new Blob([activeArtifact.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeArtifact.title}.${getFileExtension(activeArtifact)}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getFileExtension = (artifact: Artifact): string => {
        if (artifact.type === "code" && artifact.language) {
            const extensions: Record<string, string> = {
                python: "py",
                javascript: "js",
                typescript: "ts",
                html: "html",
                css: "css",
                json: "json",
                markdown: "md",
            };
            return extensions[artifact.language] || "txt";
        }
        if (artifact.type === "markdown") return "md";
        if (artifact.type === "html") return "html";
        return "txt";
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "code":
                return <Code className="w-3.5 h-3.5" />;
            case "markdown":
                return <FileText className="w-3.5 h-3.5" />;
            case "image":
                return <ImageIcon className="w-3.5 h-3.5" />;
            default:
                return <FileText className="w-3.5 h-3.5" />;
        }
    };

    if (!isPanelOpen || artifacts.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "relative flex flex-col h-full border-l border-white/5",
                "bg-gradient-to-b from-gray-900/80 to-gray-950/80 backdrop-blur-xl",
                "transition-all duration-300 ease-in-out",
                isExpanded ? "w-[600px]" : "w-[450px]"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                        {activeArtifact && getTypeIcon(activeArtifact.type)}
                    </div>
                    <span className="font-medium text-white text-sm">
                        {activeArtifact?.title || "Artifacts"}
                    </span>
                    {activeArtifact?.language && (
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs text-white/60 uppercase">
                            {activeArtifact.language}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={copyContent}
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={downloadArtifact}
                    >
                        <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={closePanel}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Tabs for multiple artifacts */}
            {artifacts.length > 1 && (
                <div className="px-4 py-2 border-b border-white/5">
                    <Tabs
                        value={activeArtifactId || artifacts[0].id}
                        onValueChange={setActiveArtifact}
                    >
                        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
                            {artifacts.map((artifact) => (
                                <TabsTrigger
                                    key={artifact.id}
                                    value={artifact.id}
                                    className="flex items-center gap-1.5 shrink-0"
                                >
                                    {getTypeIcon(artifact.type)}
                                    <span className="truncate max-w-[100px]">{artifact.title}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {activeArtifact && <ArtifactContent artifact={activeArtifact} />}
                </div>
            </ScrollArea>

            {/* Version indicator */}
            {activeArtifact && activeArtifact.version > 1 && (
                <div className="px-4 py-2 border-t border-white/5 text-xs text-white/40 text-center">
                    Version {activeArtifact.version}
                </div>
            )}
        </div>
    );
}

function ArtifactContent({ artifact }: { artifact: Artifact }) {
    switch (artifact.type) {
        case "code":
            return (
                <pre className="rounded-xl bg-black/40 border border-white/10 p-4 overflow-x-auto">
                    <code className={`language-${artifact.language || "text"} text-sm`}>
                        {artifact.content}
                    </code>
                </pre>
            );

        case "markdown":
            return (
                <div className="prose prose-invert prose-sm max-w-none">
                    {/* Would use react-markdown here */}
                    <pre className="whitespace-pre-wrap text-sm text-white/80">
                        {artifact.content}
                    </pre>
                </div>
            );

        case "html":
            return (
                <div className="rounded-xl overflow-hidden border border-white/10">
                    <div className="bg-white p-4">
                        <iframe
                            srcDoc={artifact.content}
                            className="w-full h-[400px] border-0"
                            sandbox="allow-scripts"
                        />
                    </div>
                </div>
            );

        case "mermaid":
            return (
                <div className="rounded-xl bg-white p-4 overflow-auto">
                    {/* Would use mermaid.js here */}
                    <pre className="text-sm text-gray-800">{artifact.content}</pre>
                </div>
            );

        default:
            return (
                <pre className="text-sm text-white/80 whitespace-pre-wrap">
                    {artifact.content}
                </pre>
            );
    }
}
