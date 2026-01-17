"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-white/10",
                className
            )}
        />
    );
}

// Message skeleton for loading states
export function MessageSkeleton({ variant = "assistant" }: { variant?: "user" | "assistant" }) {
    return (
        <div className={cn(
            "flex gap-4 px-6 py-5",
            variant === "user" ? "justify-end" : ""
        )}>
            {variant === "assistant" && (
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            )}
            <div className={cn(
                "space-y-3",
                variant === "user" ? "max-w-[60%]" : "flex-1 max-w-[80%]"
            )}>
                <Skeleton className={cn(
                    "h-4 rounded",
                    variant === "user" ? "w-48 ml-auto" : "w-3/4"
                )} />
                {variant === "assistant" && (
                    <>
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-2/3 rounded" />
                    </>
                )}
            </div>
            {variant === "user" && (
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            )}
        </div>
    );
}

// Conversation skeleton for sidebar
export function ConversationSkeleton() {
    return (
        <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                    <Skeleton className="w-5 h-5 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// Code block skeleton
export function CodeBlockSkeleton() {
    return (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-6 w-16 rounded" />
            </div>
            <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-2/5 rounded" />
            </div>
        </div>
    );
}

// Full page loading skeleton
export function PageLoadingSkeleton() {
    return (
        <div className="flex h-screen">
            {/* Sidebar skeleton */}
            <div className="w-72 border-r border-white/10 p-4 space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <ConversationSkeleton />
            </div>

            {/* Main content skeleton */}
            <div className="flex-1 flex flex-col">
                <div className="flex-1 p-4 space-y-4">
                    <MessageSkeleton variant="user" />
                    <MessageSkeleton variant="assistant" />
                    <MessageSkeleton variant="user" />
                    <MessageSkeleton variant="assistant" />
                </div>

                {/* Input skeleton */}
                <div className="p-6">
                    <Skeleton className="h-14 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
