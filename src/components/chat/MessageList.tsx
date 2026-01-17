"use client";

import { useRef, useEffect } from "react";
import { Message } from "./Message";
import { Message as MessageType } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

interface MessageListProps {
    messages: MessageType[];
    streamingMessageId?: string | null;
}

export function MessageList({ messages, streamingMessageId }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingMessageId]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
                <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 blur-3xl opacity-30">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600" />
                    </div>

                    {/* Icon */}
                    <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>
                </div>

                <h2 className="mt-8 text-2xl font-bold text-white">Welcome to CoWork</h2>
                <p className="mt-2 text-white/50 text-center max-w-md">
                    Your AI-powered workspace for coding, writing, and problem-solving.
                    Start a conversation to begin.
                </p>

                {/* Quick prompts */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                    {[
                        "Help me write a Python function",
                        "Explain a complex concept",
                        "Review my code for bugs",
                        "Create a React component",
                    ].map((prompt) => (
                        <button
                            key={prompt}
                            className="group px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left"
                        >
                            <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                                {prompt}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto">
                {messages.map((message) => (
                    <Message
                        key={message.id}
                        message={message}
                        isStreaming={message.id === streamingMessageId}
                    />
                ))}
                <div ref={bottomRef} className="h-4" />
            </div>
        </ScrollArea>
    );
}
