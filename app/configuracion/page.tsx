"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

// 🧠 Stores que usa el Sidebar
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

// Helpers
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseISO = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);

export default function ConfiguracionPage() {
  // Estado del rango en el DatePicker
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  // Rango actual persistido (para mostrar debajo)
  const [persisted, setPersisted] = useState<{ start?: string; end?: string } | null>(null);

  // ⬇️ Hidratar cursos y asignaturas para que el Sidebar las pinte también en /configuracion
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cursos = await window.electronAPI.leerCursos();
        if (!alive) return;

        // cursos en el sidebar
        cursoStore.cursos = cursos;

        // asignaturas por curso para cada curso (el sidebar las lee de este store)
        for (const c of cursos) {
          const asigs = await window.electronAPI.asignaturasDeCurso(c.id);
          if (!alive) return;
          asignaturasPorCurso[c.id] = asigs.map((a: any) => ({
            id: a.id,
            nombre: a.nombre,
          }));
        }
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar cursos/asignaturas para el Sidebar.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Cargar rango lectivo al entrar
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await window.electronAPI.leerRangoLectivo?.();
        if (!alive) return;
        if (r?.start && r?.end) {
          setPersisted(r);
          setRange({ from: parseISO(r.start), to: parseISO(r.end) });
        }
      } catch {
        console.warn("leerRangoLectivo no disponible aún");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rangoListo = useMemo(() => !!range?.from && !!range?.to && range.from <= range.to, [range]);

  const handleSave = useCallback(async () => {
    if (!rangoListo || !range?.from || !range?.to) {
      toast.warning("Selecciona un rango válido (inicio y fin).");
      return;
    }
    const payload = { start: ymd(range.from), end: ymd(range.to) };
    try {
      await window.electronAPI.guardarRangoLectivo?.(payload);
      setPersisted(payload);
      toast.success("Periodo lectivo guardado.");
    } catch (e) {
      console.error(e);
      toast.message("Periodo aplicado en memoria (IPC no disponible).");
      setPersisted(payload);
    }
  }, [rangoListo, range]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/configuracion">Configuración</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Periodo lectivo</CardTitle>
              <CardDescription>
                Define el intervalo de clases. Se usará para bloquear navegación, creación y
                movimiento de eventos fuera de rango en el calendario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !range && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {range?.from ? (
                        range.to ? (
                          <>
                            {range.from.toLocaleDateString()} — {range.to.toLocaleDateString()}
                          </>
                        ) : (
                          range.from.toLocaleDateString()
                        )
                      ) : (
                        <span>Selecciona periodo</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="z-50 w-auto p-0"
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    avoidCollisions={false}
                    collisionPadding={0}
                    // @ts-expect-error prop Radix
                    position="popper"
                  >
                    <Calendar
                      mode="range"
                      selected={range}
                      onSelect={setRange}
                      numberOfMonths={2}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button onClick={handleSave} disabled={!rangoListo} className="gap-2">
                  <Save className="h-4 w-4" />
                  Guardar periodo
                </Button>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                {persisted?.start && persisted?.end ? (
                  <>
                    Lectivo actual:{" "}
                    <span className="font-medium">{persisted.start}</span> →{" "}
                    <span className="font-medium">{persisted.end}</span>
                  </>
                ) : (
                  <>Aún no hay periodo lectivo guardado.</>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
