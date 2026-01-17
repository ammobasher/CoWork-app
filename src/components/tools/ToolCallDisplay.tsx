"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Loader2,
    Clock,
    Code,
    Terminal,
} from "lucide-react";
import { ToolCall } from "@/types";
import { cn } from "@/lib/utils";

interface ToolCallDisplayProps {
    toolCall: ToolCall;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusIcon = () => {
        switch (toolCall.status) {
            case "pending":
                return <Clock className="w-4 h-4 text-yellow-400" />;
            case "running":
                return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            case "success":
                return <CheckCircle2 className="w-4 h-4 text-green-400" />;
            case "error":
                return <XCircle className="w-4 h-4 text-red-400" />;
        }
    };

    const getStatusColor = () => {
        switch (toolCall.status) {
            case "pending":
                return "border-yellow-500/30 bg-yellow-500/5";
            case "running":
                return "border-blue-500/30 bg-blue-500/5";
            case "success":
                return "border-green-500/30 bg-green-500/5";
            case "error":
                return "border-red-500/30 bg-red-500/5";
        }
    };

    const formatDuration = () => {
        if (!toolCall.completedAt) return null;
        const start = new Date(toolCall.startedAt).getTime();
        const end = new Date(toolCall.completedAt).getTime();
        const duration = end - start;

        if (duration < 1000) return `${duration}ms`;
        return `${(duration / 1000).toFixed(2)}s`;
    };

    return (
        <div
            className={cn(
                "rounded-xl border transition-all duration-200",
                getStatusColor()
            )}
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
                <div className="shrink-0">
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-white/50" />
                    )}
                </div>

                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4 text-white/70" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">
                            {formatToolName(toolCall.name)}
                        </span>
                        {formatDuration() && (
                            <span className="text-xs text-white/40">
                                {formatDuration()}
                            </span>
                        )}
                    </div>
                    {!isExpanded && toolCall.status === "success" && (
                        <p className="text-xs text-white/50 truncate mt-0.5">
                            Completed successfully
                        </p>
                    )}
                </div>

                <div className="shrink-0">{getStatusIcon()}</div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Arguments */}
                    <div>
                        <p className="text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                            Arguments
                        </p>
                        <pre className="rounded-lg bg-black/30 p-3 text-xs text-white/70 overflow-x-auto">
                            {JSON.stringify(toolCall.arguments, null, 2)}
                        </pre>
                    </div>

                    {/* Result */}
                    {toolCall.result !== undefined && (
                        <div>
                            <p className="text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                                Result
                            </p>
                            <pre className="rounded-lg bg-black/30 p-3 text-xs text-white/70 overflow-x-auto max-h-48">
                                {typeof toolCall.result === "string"
                                    ? toolCall.result
                                    : JSON.stringify(toolCall.result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function formatToolName(name: string): string {
    return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

interface ToolCallListProps {
    toolCalls: ToolCall[];
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
    if (toolCalls.length === 0) return null;

    return (
        <div className="space-y-2 my-4">
            {toolCalls.map((toolCall) => (
                <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
            ))}
        </div>
    );
}
