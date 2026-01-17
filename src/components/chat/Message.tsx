"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { Copy, Check, Play, User, Sparkles } from "lucide-react";
import { useState } from "react";
import { Message as MessageType } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MessageProps {
    message: MessageType;
    isStreaming?: boolean;
}

export function Message({ message, isStreaming = false }: MessageProps) {
    const isUser = message.role === "user";
    const isAssistant = message.role === "assistant";

    return (
        <div
            className={cn(
                "group relative flex gap-4 px-4 py-6",
                isUser ? "bg-transparent" : "bg-white/[0.02]"
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
                    isUser
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-violet-600 to-indigo-600"
                )}
            >
                {isUser ? (
                    <User className="w-4 h-4 text-white" />
                ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Role label */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-300">
                        {isUser ? "You" : "CoWork"}
                    </span>
                    {isStreaming && (
                        <span className="flex items-center gap-1 text-xs text-violet-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            Thinking...
                        </span>
                    )}
                </div>

                {/* Message content */}
                <div
                    className={cn(
                        "prose prose-invert prose-sm max-w-none",
                        // Main paragraph text - high contrast
                        "prose-p:text-gray-100 prose-p:leading-relaxed",
                        // Headings - maximum contrast
                        "prose-headings:text-white prose-headings:font-semibold",
                        // Bold text
                        "prose-strong:text-white prose-strong:font-semibold",
                        // Inline code - visible but distinct
                        "prose-code:text-emerald-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
                        // Code blocks
                        "prose-pre:bg-transparent prose-pre:p-0",
                        // Links - bright and visible
                        "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",
                        // Lists - high contrast
                        "prose-ul:text-gray-100 prose-ol:text-gray-100",
                        "prose-li:text-gray-100 prose-li:marker:text-gray-400",
                        // Blockquotes
                        "prose-blockquote:text-gray-200 prose-blockquote:border-l-violet-500"
                    )}
                >
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        components={{
                            pre: ({ children }) => (
                                <div className="relative group/code">
                                    <pre className="rounded-xl bg-black/40 border border-white/10 p-4 overflow-x-auto">
                                        {children}
                                    </pre>
                                </div>
                            ),
                            code: ({ className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || "");
                                const isBlock = match !== null;

                                if (isBlock) {
                                    return (
                                        <CodeBlock
                                            language={match[1]}
                                            code={String(children).replace(/\n$/, "")}
                                        />
                                    );
                                }

                                return (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {/* Streaming cursor */}
                {isStreaming && (
                    <span className="inline-block w-2 h-4 ml-0.5 bg-violet-400 animate-pulse rounded-sm" />
                )}
            </div>
        </div>
    );
}

interface CodeBlockProps {
    language: string;
    code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group/code rounded-xl bg-black/40 border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                    {language}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-white/50 hover:text-white"
                        onClick={copyToClipboard}
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                    {(language === "python" || language === "javascript" || language === "js") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-white/50 hover:text-white"
                        >
                            <Play className="w-3.5 h-3.5" />
                            <span className="ml-1 text-xs">Run</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Code */}
            <pre className="p-4 overflow-x-auto">
                <code className={`language-${language} text-sm`}>{code}</code>
            </pre>
        </div>
    );
}
