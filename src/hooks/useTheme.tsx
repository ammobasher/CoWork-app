"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores";

export function useTheme() {
    const { settings, getResolvedTheme } = useSettingsStore();
    // Start with dark to match server render, update after hydration
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [mounted, setMounted] = useState(false);

    // Set mounted flag after hydration
    useEffect(() => {
        setMounted(true);
    }, []);

    // Update theme after mount to avoid hydration mismatch
    useEffect(() => {
        if (!mounted) return;

        const resolvedTheme = getResolvedTheme();
        setTheme(resolvedTheme);

        const root = document.documentElement;
        if (resolvedTheme === "dark") {
            root.classList.add("dark");
            root.classList.remove("light");
        } else {
            root.classList.add("light");
            root.classList.remove("dark");
        }
    }, [mounted, settings.theme, getResolvedTheme]);

    // Listen for system theme changes
    useEffect(() => {
        if (!mounted || settings.theme !== "system") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = () => {
            const newTheme = mediaQuery.matches ? "dark" : "light";
            setTheme(newTheme);

            const root = document.documentElement;
            if (newTheme === "dark") {
                root.classList.add("dark");
                root.classList.remove("light");
            } else {
                root.classList.add("light");
                root.classList.remove("dark");
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [mounted, settings.theme]);

    return theme;
}

