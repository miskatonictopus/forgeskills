"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // ⚡ evitar flash/hidratación incorrecta
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  return (
    <button
      type="button"
      aria-label="Cambiar tema claro/oscuro"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex items-center justify-center rounded-md",
        "border border-zinc-700/50 bg-background/70 hover:bg-zinc-800/40",
        "h-8 w-8 transition-colors",
        className
      )}
    >
      {/* ☀️ Sol */}
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        )}
      />
      {/* 🌙 Luna */}
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        )}
      />
    </button>
  );
}
