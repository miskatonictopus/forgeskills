// app/(shell)/layout.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar"; // si tu trigger está aquí
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import ThemeToggle from "@/components/theme-toggle";
import { TimerTray } from "@/components/TimerTray";

// Etiquetas legibles por ruta
const LABELS: Record<string, string> = {
  dashboard: "Panel de Control",
  cursos: "Cursos",
  asignaturas: "Asignaturas",
  alumnos: "Alumnos",
  actividades: "Actividades",
  calendario: "Calendario",
  // añade aquí más claves si las necesitas
};

function useBreadcrumbs() {
  const pathname = usePathname() || "/";
  const parts = pathname.split("/").filter(Boolean);

  const items = parts.map((seg, idx) => {
    const href = "/" + parts.slice(0, idx + 1).join("/");
    // Si es UUID/ID u otro slug, mostramos el propio valor.
    // Para segmentos conocidos usamos LABELS.
    const label =
      LABELS[seg] ??
      seg
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    return { href, label };
  });

  // Si no hay partes, mostramos Dashboard
  if (items.length === 0) {
    return [{ href: "/dashboard", label: "Panel de Control" }];
  }
  return items;
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  // -------- Hora en header --------
  const [fechaActual, setFechaActual] = React.useState("");
  React.useEffect(() => {
    const interval = setInterval(() => {
      const ahora = new Date();
      const txt = ahora.toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setFechaActual(txt);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const crumbs = useBreadcrumbs();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 px-4">
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
              <span className="text-xl font-bold tabular-nums">
                {fechaActual}
              </span>
              <TimerTray />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
