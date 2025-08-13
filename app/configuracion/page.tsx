"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Save, Plus, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

// 🧠 Stores que usa el Sidebar
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

// NUEVO: UI extra shadcn
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Helpers
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);

// Tipos festivos
type Festivo = { id: string; start: string; end?: string | null; title: string };

export default function ConfiguracionPage() {
  // ====== Periodo lectivo ======
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [persisted, setPersisted] = useState<{ start?: string; end?: string } | null>(null);

  // ====== Festivos ======
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [festivoRange, setFestivoRange] = useState<DateRange | undefined>(undefined);
  const [motivo, setMotivo] = useState("");

  const canSaveFestivo = !!festivoRange?.from && !!motivo.trim();
  const rangoListo = useMemo(() => !!range?.from && !!range?.to && range.from <= range.to, [range]);

  // Hidratar cursos + asignaturas (para que el Sidebar se vea igual que en otras páginas)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cursos = await window.electronAPI.leerCursos();
        if (!alive) return;

        cursoStore.cursos = cursos;
        for (const c of cursos) {
          const asigs = await window.electronAPI.asignaturasDeCurso(c.id);
          if (!alive) return;
          asignaturasPorCurso[c.id] = asigs.map((a: any) => ({ id: a.id, nombre: a.nombre }));
        }
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar cursos/asignaturas para el Sidebar.");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Cargar periodo lectivo y festivos al entrar
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
      try {
        const f = await window.electronAPI.listarFestivos?.();
        if (!alive) return;
        if (Array.isArray(f)) setFestivos(f as Festivo[]);
      } catch { /* no-op */ }
    })();
    return () => { alive = false; };
  }, []);

  // Guardar periodo lectivo
  const handleSaveLectivo = useCallback(async () => {
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

  // Crear festivo
  const handleAddFestivo = useCallback(async () => {
    if (!festivoRange?.from || !motivo.trim()) {
      toast.warning("Selecciona fecha o rango y escribe un motivo.");
      return;
    }
  
    const payload = {
      start: ymd(festivoRange.from),
      end: festivoRange.to ? ymd(festivoRange.to) : null,
      title: motivo.trim(),
    };
  
    try {
      const nuevo: Festivo = await window.electronAPI.crearFestivo(payload); // ✅ id string
      setFestivos((prev) => [nuevo, ...prev]);
      setFestivoRange(undefined);
      setMotivo("");
      toast.success("Festivo añadido.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear el festivo.");
    }
  }, [festivoRange, motivo]);

  // Borrar festivo
  const handleDeleteFestivo = useCallback(async (id: string) => {
    try {
      await window.electronAPI.borrarFestivo?.(id);
      setFestivos((prev) => prev.filter((f) => f.id !== id));
      toast.success("Festivo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el festivo.");
    }
  }, []);

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

          {/* ===== Card Periodo lectivo ===== */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Periodo lectivo</CardTitle>
              <CardDescription>
                Define el intervalo de clases. Se usará para bloquear navegación, creación y movimiento de eventos fuera de rango.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-[280px] justify-start text-left font-normal", !range && "text-muted-foreground")}
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
                    <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} initialFocus />
                  </PopoverContent>
                </Popover>

                <Button onClick={handleSaveLectivo} disabled={!rangoListo} className="gap-2">
                  <Save className="h-4 w-4" />
                  Guardar periodo
                </Button>
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                {persisted?.start && persisted?.end ? (
                  <>Lectivo actual: <span className="font-medium">{persisted.start}</span> → <span className="font-medium">{persisted.end}</span></>
                ) : (
                  <>Aún no hay periodo lectivo guardado.</>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ===== Card Festivos ===== */}
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Festivos</CardTitle>
              <CardDescription>
                Crea días o rangos no lectivos con su motivo. El calendario bloqueará la creación y movimiento de eventos en estas fechas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !festivoRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {festivoRange?.from
                        ? festivoRange.to
                          ? `${festivoRange.from.toLocaleDateString()} — ${festivoRange.to.toLocaleDateString()}`
                          : festivoRange.from.toLocaleDateString()
                        : "Selecciona fecha o rango"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="z-50 w-auto p-0"
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    avoidCollisions={false}
                    collisionPadding={0}
                    // @ts-expect-error Radix
                    position="popper"
                  >
                    <Calendar mode="range" selected={festivoRange} onSelect={setFestivoRange} numberOfMonths={2} initialFocus />
                  </PopoverContent>
                </Popover>

                <Textarea
                  placeholder="Motivo (p. ej., Fiesta nacional, Semana Santa, Puente local...)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="min-w-[280px] w-[400px]"
                  rows={2}
                />

                <Button onClick={handleAddFestivo} disabled={!canSaveFestivo} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Añadir festivo
                </Button>
              </div>

              <Separator />

              {festivos.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay festivos guardados aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Fecha</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="w-[80px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {festivos.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">
                            {f.end && f.end !== f.start ? (
                              <Badge variant="secondary">{f.start} → {f.end}</Badge>
                            ) : (
                              <Badge variant="secondary">{f.start}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{f.title}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteFestivo(f.id)} aria-label="Eliminar festivo">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
