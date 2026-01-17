"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

// Toast types
export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// Convenience functions
export function useToastHelpers() {
    const { addToast } = useToast();

    return {
        success: (title: string, description?: string) =>
            addToast({ type: "success", title, description }),
        error: (title: string, description?: string) =>
            addToast({ type: "error", title, description, duration: 6000 }),
        info: (title: string, description?: string) =>
            addToast({ type: "info", title, description }),
        warning: (title: string, description?: string) =>
            addToast({ type: "warning", title, description }),
    };
}

// Toast Component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    };

    const backgrounds = {
        success: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
        error: "from-red-500/20 to-red-600/10 border-red-500/30",
        info: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
        warning: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    };

    return (
        <div
            className={cn(
                "relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl",
                "bg-gradient-to-r shadow-lg",
                "animate-slide-in-right",
                backgrounds[toast.type]
            )}
            role="alert"
        >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{toast.title}</p>
                {toast.description && (
                    <p className="mt-1 text-sm text-white/70">{toast.description}</p>
                )}
            </div>
            <button
                onClick={onRemove}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4 text-white/50" />
            </button>
        </div>
    );
}

// Toast Container
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
                </div>
            ))}
        </div>
    );
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = crypto.randomUUID();
        const duration = toast.duration || 4000;

        setToasts((prev) => [...prev, { ...toast, id }]);

        // Auto-remove after duration
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}
