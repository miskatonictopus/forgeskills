// app/(shell)/layout.tsx
"use client";
import ClientShell from "@/components/ClientShell";
import * as React from "react";
import { usePathname } from "next/navigation";
import { AsignaturaColorsProvider } from "@/providers/AsignaturaColorsProvider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import "@pqina/flip/dist/flip.min.css";
import ThemeToggle from "@/components/theme-toggle";
import { TimerTray } from "@/components/TimerTray";
import PqinaFlipClock from "@/components/PqinaFlipClock";
import TimerFullscreen from "@/components/TimerFullscreen";

const LABELS: Record<string, string> = {
  dashboard: "Panel de Control",
  cursos: "Cursos",
  asignaturas: "Asignaturas",
  alumnos: "Alumnos",
  actividades: "Actividades",
  calendario: "Calendario",
};

function useBreadcrumbs() {
  const pathname = usePathname() || "/";
  const parts = pathname.split("/").filter(Boolean);

  const items = parts.map((seg, idx) => {
    const href = "/" + parts.slice(0, idx + 1).join("/");
    const label =
      LABELS[seg] ??
      seg.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    return { href, label };
  });

  return items.length === 0
    ? [{ href: "/dashboard", label: "Panel de Control" }]
    : items;
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const crumbs = useBreadcrumbs();

  const [fechaCorta, setFechaCorta] = React.useState("");
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      setFechaCorta(
        d.toLocaleDateString("es-ES", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    // ⬇️ Envolvemos TODO con el provider de colores
    <AsignaturaColorsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 items-center gap-2 px-4 bg-zinc-900">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4 mx-2" />

            <div className="flex items-center justify-between w-full px-4 py-2">
              {/* Breadcrumbs */}
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

              {/* Derecha: Reloj + Fecha + Timer + Tema */}
              <div className="flex items-center gap-3">
                <PqinaFlipClock
                  className="hidden sm:inline-flex
                   [--tick-fs:1.10rem]
                   [--tick-pad-y:.18em]
                   [--tick-pad-x:.7ch]
                   [--tick-radius:.1rem]
                   [--tick-gap:.4rem]"
                />
                <span className="hidden md:inline text-sm text-muted-foreground tabular-nums">
                  {fechaCorta}
                </span>
                <TimerTray />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main>{children}</main>
        </SidebarInset>

        {/* Portal de pantalla completa del temporizador */}
        <TimerFullscreen />
      </SidebarProvider>
    </AsignaturaColorsProvider>
  );
}
