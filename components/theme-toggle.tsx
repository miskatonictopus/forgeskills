// components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun className={`h-4 w-4 ${isDark ? "text-muted-foreground" : "text-zinc-900"}`} />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Cambiar tema claro/oscuro"
      />
      <Moon className={`h-4 w-4 ${isDark ? "text-muted-foreground" : "text-zinc-900"}`} />
    </div>
  );
}

export default ThemeToggle;
