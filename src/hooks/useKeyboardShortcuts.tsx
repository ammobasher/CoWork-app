"use client";

import { useEffect, useCallback } from "react";
import { useUIStore, useConversationStore, useArtifactStore, useSettingsStore } from "@/stores";

interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    action: () => void;
    description: string;
}

export function useKeyboardShortcuts() {
    const { toggleSidebar, openSettings } = useUIStore();
    const { createConversation } = useConversationStore();
    const { togglePanel } = useArtifactStore();
    const { settings, updateSettings } = useSettingsStore();

    const shortcuts: KeyboardShortcut[] = [
        {
            key: "b",
            meta: true,
            action: toggleSidebar,
            description: "Toggle sidebar",
        },
        {
            key: "n",
            meta: true,
            action: () => createConversation(),
            description: "New conversation",
        },
        {
            key: ",",
            meta: true,
            action: openSettings,
            description: "Open settings",
        },
        {
            key: "\\",
            meta: true,
            action: togglePanel,
            description: "Toggle artifact panel",
        },
        {
            key: "d",
            meta: true,
            shift: true,
            action: () => {
                const newTheme = settings.theme === "dark" ? "light" : "dark";
                updateSettings({ theme: newTheme });
            },
            description: "Toggle theme",
        },
    ];

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const modifier = isMac ? event.metaKey : event.ctrlKey;

            for (const shortcut of shortcuts) {
                const modifierMatch = shortcut.meta ? modifier : !modifier;
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

                if (
                    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
                    modifierMatch &&
                    shiftMatch
                ) {
                    event.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return shortcuts;
}

export function KeyboardShortcutsInfo() {
    const shortcuts = useKeyboardShortcuts();
    const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? "⌘" : "Ctrl";

    return (
        <div className="space-y-2">
            {shortcuts.map((shortcut) => (
                <div
                    key={shortcut.key}
                    className="flex items-center justify-between text-sm"
                >
                    <span className="text-white/70">{shortcut.description}</span>
                    <kbd className="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs">
                        {modKey}
                        {shortcut.shift && "+Shift"}+{shortcut.key.toUpperCase()}
                    </kbd>
                </div>
            ))}
        </div>
    );
}
