// components/ClientShell.tsx
"use client";

import * as React from "react";
import { AsignaturaColorsProvider } from "@/providers/AsignaturaColorsProvider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ThemeToggle from "@/components/theme-toggle";
import { TimerTray } from "@/components/TimerTray";
import PqinaFlipClock from "@/components/PqinaFlipClock";
import TimerFullscreen from "@/components/TimerFullscreen";

function useBreadcrumbs() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const LABELS: Record<string, string> = {
    dashboard: "Panel de Control", cursos: "Cursos", asignaturas: "Asignaturas",
    alumnos: "Alumnos", actividades: "Actividades", calendario: "Calendario",
    configuracion: "Configuración",
  };
  const parts = pathname.split("/").filter(Boolean);
  const items = parts.map((seg, idx) => ({
    href: "/" + parts.slice(0, idx + 1).join("/"),
    label: LABELS[seg] ?? seg.replace(/[-_]/g, " ").replace(/\b\w/g, m => m.toUpperCase()),
  }));
  return items.length === 0 ? [{ href: "/dashboard", label: "Panel de Control" }] : items;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const crumbs = useBreadcrumbs();
  const [fechaCorta, setFechaCorta] = React.useState("");
  React.useEffect(() => {
    const tick = () => setFechaCorta(
      new Date().toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    );
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <AsignaturaColorsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center gap-2 px-4 bg-zinc-900">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4 mx-2" />
            <div className="flex items-center justify-between w-full px-4 py-2">
              <Breadcrumb>
                <BreadcrumbList>
                  {crumbs.map((c, i) => (
                    <React.Fragment key={c.href}>
                      <BreadcrumbItem>
                        <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
                      </BreadcrumbItem>
                      {i < crumbs.length - 1 && <BreadcrumbSeparator />}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-3">
                <PqinaFlipClock className="hidden sm:inline-flex [--tick-fs:1.10rem] [--tick-pad-y:.18em] [--tick-pad-x:.7ch] [--tick-radius:.1rem] [--tick-gap:.4rem]" />
                <span className="hidden md:inline text-sm text-muted-foreground tabular-nums">{fechaCorta}</span>
                <TimerTray />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </SidebarInset>
        <TimerFullscreen />
      </SidebarProvider>
    </AsignaturaColorsProvider>
  );
}
