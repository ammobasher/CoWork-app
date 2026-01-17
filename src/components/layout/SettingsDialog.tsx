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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Check,
    Eye,
    EyeOff,
    Sparkles,
    Zap,
    Bot,
    Sun,
    Moon,
    Monitor,
} from "lucide-react";
import { useSettingsStore, useUIStore } from "@/stores";
import { cn } from "@/lib/utils";
import { AIProvider } from "@/types";

const providers = [
    {
        id: "gemini" as AIProvider,
        name: "Google Gemini",
        icon: Sparkles,
        models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
        color: "from-blue-500 to-cyan-500",
    },
    {
        id: "openai" as AIProvider,
        name: "OpenAI",
        icon: Zap,
        models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        color: "from-green-500 to-emerald-500",
    },
    {
        id: "anthropic" as AIProvider,
        name: "Anthropic",
        icon: Bot,
        models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
        color: "from-orange-500 to-amber-500",
    },
];

const themes = [
    { id: "light", name: "Light", icon: Sun },
    { id: "dark", name: "Dark", icon: Moon },
    { id: "system", name: "System", icon: Monitor },
];

export function SettingsDialog() {
    const { isSettingsOpen, closeSettings } = useUIStore();
    const { settings, apiKeys, activeModel, updateSettings, setApiKey, setActiveModel } =
        useSettingsStore();
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

    const selectedProvider = providers.find((p) => p.id === settings.aiProvider);

    return (
        <Dialog open={isSettingsOpen} onOpenChange={closeSettings}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        Settings
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="providers" className="mt-4">
                    <TabsList>
                        <TabsTrigger value="providers">AI Providers</TabsTrigger>
                        <TabsTrigger value="appearance">Appearance</TabsTrigger>
                        <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="providers" className="mt-6 space-y-6">
                        {/* Provider Selection */}
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                Active Provider
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {providers.map((provider) => {
                                    const Icon = provider.icon;
                                    const isActive = settings.aiProvider === provider.id;
                                    const isConfigured = !!apiKeys[provider.id];

                                    return (
                                        <button
                                            key={provider.id}
                                            onClick={() =>
                                                updateSettings({ aiProvider: provider.id })
                                            }
                                            className={cn(
                                                "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                                                isActive
                                                    ? "border-violet-500/50 bg-violet-500/10"
                                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                                    provider.color
                                                )}
                                            >
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="text-sm font-medium text-white">
                                                {provider.name}
                                            </span>
                                            {isConfigured && (
                                                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* API Key Input */}
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                API Key for {selectedProvider?.name}
                            </label>
                            <div className="relative">
                                <Input
                                    type={showKeys[settings.aiProvider] ? "text" : "password"}
                                    value={apiKeys[settings.aiProvider] || ""}
                                    onChange={(e) => setApiKey(settings.aiProvider, e.target.value)}
                                    placeholder={`Enter your ${selectedProvider?.name} API key`}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowKeys((prev) => ({
                                            ...prev,
                                            [settings.aiProvider]: !prev[settings.aiProvider],
                                        }))
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                >
                                    {showKeys[settings.aiProvider] ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-white/40">
                                Your API key is stored locally and never sent to our servers.
                            </p>
                        </div>

                        {/* Model Selection */}
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                Model
                            </label>
                            <div className="space-y-2">
                                {selectedProvider?.models.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setActiveModel(model)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200",
                                            activeModel === model
                                                ? "border-violet-500/50 bg-violet-500/10"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        <span className="text-sm text-white">{model}</span>
                                        {activeModel === model && (
                                            <Check className="w-4 h-4 text-violet-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="appearance" className="mt-6 space-y-6">
                        {/* Theme Selection */}
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                Theme
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {themes.map((theme) => {
                                    const Icon = theme.icon;
                                    const isActive = settings.theme === theme.id;

                                    return (
                                        <button
                                            key={theme.id}
                                            onClick={() =>
                                                updateSettings({
                                                    theme: theme.id as "light" | "dark" | "system",
                                                })
                                            }
                                            className={cn(
                                                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                                                isActive
                                                    ? "border-violet-500/50 bg-violet-500/10"
                                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                                            )}
                                        >
                                            <Icon className="w-5 h-5 text-white/70" />
                                            <span className="text-sm font-medium text-white">
                                                {theme.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Font Size */}
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                Font Size
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {["small", "medium", "large"].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() =>
                                            updateSettings({
                                                fontSize: size as "small" | "medium" | "large",
                                            })
                                        }
                                        className={cn(
                                            "flex items-center justify-center py-3 rounded-xl border transition-all duration-200",
                                            settings.fontSize === size
                                                ? "border-violet-500/50 bg-violet-500/10"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "font-medium text-white capitalize",
                                                size === "small" && "text-xs",
                                                size === "medium" && "text-sm",
                                                size === "large" && "text-base"
                                            )}
                                        >
                                            {size}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="shortcuts" className="mt-6 space-y-6">
                        <div>
                            <label className="text-sm font-medium text-white/70 mb-3 block">
                                Keyboard Shortcuts
                            </label>
                            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">Toggle sidebar</span>
                                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">⌘B</kbd>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">New conversation</span>
                                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">⌘N</kbd>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">Open settings</span>
                                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">⌘,</kbd>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">Toggle artifact panel</span>
                                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">⌘\</kbd>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/70">Toggle theme</span>
                                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">⌘⇧D</kbd>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-white/40">
                                On Windows/Linux, use Ctrl instead of ⌘
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
