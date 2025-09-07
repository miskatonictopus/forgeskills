"use client";
import BackupsCard from "@/components/BackupsCard"; // ajusta la ruta
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Calendar as CalendarIcon, Save, Plus, Trash2, Settings, Clock2, DatabaseBackup } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import type { FCTTramo } from "@/types/electronAPI";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

// 🧠 Stores que usa el Sidebar
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

// UI extra shadcn
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Helpers
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);

// Tipos festivos
type Festivo = { id: string; start: string; end?: string | null; title: string };

// Tipos presencialidades
type Presencialidad = { id: string; diaSemana: number; horaInicio: string; horaFin: string };

const DIAS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  // añade 0 y 6 si quieres fines de semana
];

export default function ConfiguracionPage() {
  // ====== Periodo lectivo ======
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [persisted, setPersisted] = useState<{ start?: string; end?: string } | null>(null);

  // ====== Festivos ======
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [festivoRange, setFestivoRange] = useState<DateRange | undefined>(undefined);
  const [motivo, setMotivo] = useState("");

  // ====== Presencialidades ======
  const [presencialidades, setPresencialidades] = useState<Presencialidad[]>([]);
  const [diaSemana, setDiaSemana] = useState<string>("1");
  const [horaInicio, setHoraInicio] = useState<string>("08:00");
  const [horaFin, setHoraFin] = useState<string>("09:00");

  // ====== FCT (tramos recurrentes) ======
  const [fct, setFct] = useState<FCTTramo[]>([]);
  const [fctDia, setFctDia] = useState<string>("1");
  const [fctInicio, setFctInicio] = useState<string>("08:00");
  const [fctFin, setFctFin] = useState<string>("10:00");

  const canSaveFestivo = !!festivoRange?.from && !!motivo.trim();
  const rangoListo = useMemo(() => !!range?.from && !!range?.to && range.from <= range.to, [range]);

  // plegado por defecto
  const [openHorarios, setOpenHorarios] = useState(false);
  const [openBackups, setOpenBackups] = useState(false); // o false si quieres que salga cerrada


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

  // Cargar periodo lectivo, festivos, presencialidades y FCT al entrar
  const cargarFestivos = useCallback(async () => {
    const f = await window.electronAPI.listarFestivos?.();
    if (Array.isArray(f)) setFestivos(f as Festivo[]);
  }, []);

  const cargarPresencialidades = useCallback(async () => {
    try {
      const rows = await window.electronAPI.listarPresencialidades?.();
      if (Array.isArray(rows)) setPresencialidades(rows as Presencialidad[]);
    } catch { /* no-op */ }
  }, []);

  const cargarFCT = useCallback(async () => {
    try {
      const rows = await window.electronAPI.listarFCT?.();
      if (Array.isArray(rows)) setFct(rows);
    } catch { /* no-op */ }
  }, []);

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
        await Promise.all([cargarFestivos(), cargarPresencialidades(), cargarFCT()]);
      } catch { /* no-op */ }
    })();
    return () => { alive = false; };
  }, [cargarFestivos, cargarPresencialidades, cargarFCT]);

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
      const nuevo: Festivo = await window.electronAPI.crearFestivo(payload);
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

  // Crear presencialidad
  const handleAddPresencialidad = useCallback(async () => {
    if (!diaSemana || !horaInicio || !horaFin) {
      toast.warning("Completa día y horas.");
      return;
    }
    if (horaFin <= horaInicio) {
      toast.warning("La hora fin debe ser posterior a la de inicio.");
      return;
    }
    try {
      await window.electronAPI.crearPresencialidad?.({
        diaSemana: Number(diaSemana),
        horaInicio,
        horaFin,
      });
      toast.success("Presencialidad añadida.");
      setHoraInicio("08:00");
      setHoraFin("09:00");
      await cargarPresencialidades();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo añadir la presencialidad.");
    }
  }, [diaSemana, horaInicio, horaFin, cargarPresencialidades]);

  // Borrar presencialidad
  const handleDeletePresencialidad = useCallback(async (id: string) => {
    try {
      await window.electronAPI.borrarPresencialidad?.(id);
      await cargarPresencialidades();
    } catch {
      toast.error("No se pudo borrar la presencialidad.");
    }
  }, [cargarPresencialidades]);

  // Crear FCT
  const handleAddFCT = useCallback(async () => {
    if (!fctDia || !fctInicio || !fctFin) {
      toast.warning("Completa día y horas.");
      return;
    }
    if (fctFin <= fctInicio) {
      toast.warning("La hora fin debe ser posterior a la de inicio.");
      return;
    }
    try {
      await window.electronAPI.crearFCT?.({
        diaSemana: Number(fctDia),
        horaInicio: fctInicio,
        horaFin: fctFin,
      });
      toast.success("FCT añadida.");
      setFctInicio("08:00");
      setFctFin("10:00");
      await cargarFCT();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo añadir la FCT.");
    }
  }, [fctDia, fctInicio, fctFin, cargarFCT]);

  // Borrar FCT
  const handleDeleteFCT = useCallback(async (id: string) => {
    try {
      await window.electronAPI.borrarFCT?.(id);
      await cargarFCT();
    } catch {
      toast.error("No se pudo borrar la FCT.");
    }
  }, [cargarFCT]);

  return (

      

        
<main>
  {/* Contenido */}
  <div className="p-6 space-y-6">
  <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight leading-none">
  <Settings className="h-7 w-7 shrink-0" aria-hidden="true" />
  <span>Configuración</span>
</h1>

    {/* GRID: izquierda (2 col) → horarios/festivos ; derecha (1 col) → backups */}
    <div className="grid grid-cols-2 lg:grid-cols-2 gap-6">
      {/* Columna izquierda */}
      <div >
        {/* ===== Tarjeta plegable: Configurar horarios ===== */}
        <Collapsible open={openHorarios} onOpenChange={setOpenHorarios}>
          <Card className="border-muted/60">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                <Clock2 className="h-5 w-5 shrink-0 mr-2" aria-hidden="true" />
                  <CardTitle>Configurar horarios</CardTitle>
                  </div>
                  <CardDescription className="ml-7 mt-1">
                    Periodo lectivo, presencialidades, FCT y festivos.
                  </CardDescription>
                </div>

                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    {openHorarios ? "Ocultar" : "Mostrar"}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${openHorarios ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="pt-6 space-y-6">
                {/* ===== Contenido Horarios/Festivos/FCT ===== */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Card interna: Periodo lectivo + Presencialidades + FCT + Festivos */}
                  <Card>
                    {/* === Periodo lectivo === */}
                    <CardHeader>
                      <CardTitle>Periodo lectivo</CardTitle>
                      <CardDescription className="text-xs">
                        DEFINE EL INTERVALO DE CLASES LECTIVAS<br/>Se usará para bloquear navegación, creación y movimiento de eventos fuera de rango.
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

                        <Button onClick={handleSaveLectivo} disabled={!rangoListo} className="gap-2 text-xs">
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

                    <Separator className="my-4" />

                    {/* === Presencialidades === */}
                    <CardHeader>
                      <CardTitle>Presencialidades</CardTitle>
                      <CardDescription className="text-xs">
                        PRESENCIALIDADES Y GUARDIAS<br/>Tramos fijos y recurrentes de presencia en el centro (no lectivos).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Formulario alta */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-sm font-medium">Día</label>
                          <Select value={diaSemana} onValueChange={setDiaSemana}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                            <SelectContent>
                              {DIAS.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Inicio</label>
                          <Input className="mt-1" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Fin</label>
                          <Input className="mt-1" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                        </div>
                      </div>

                      <Button onClick={handleAddPresencialidad} className="gap-2 w-full sm:w-auto text-xs">
                        <Plus className="h-4 w-4" />
                        Añadir presencialidad
                      </Button>

                      <Separator />
                      {presencialidades.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No hay presencialidades registradas.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Día</TableHead>
                                <TableHead>Horario</TableHead>
                                <TableHead className="w-[80px] text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {presencialidades.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">
                                    {DIAS.find((d) => d.value === p.diaSemana)?.label ?? p.diaSemana}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{p.horaInicio} — {p.horaFin}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeletePresencialidad(p.id)}
                                      aria-label="Eliminar presencialidad"
                                    >
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

                    <Separator className="my-4" />

                    {/* === FCT === */}
                    <CardHeader>
                      <CardTitle>FCT (prácticas con alumnado)</CardTitle>
                      <CardDescription className="text-xs">Tramos fijos y recurrentes (no lectivos) asociados a FCT.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-sm font-medium">Día</label>
                          <Select value={fctDia} onValueChange={setFctDia}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Día" />
                            </SelectTrigger>
                            <SelectContent>
                              {DIAS.map((d) => (
                                <SelectItem key={d.value} value={String(d.value)}>
                                  {d.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Inicio</label>
                          <Input className="mt-1" type="time" value={fctInicio} onChange={(e) => setFctInicio(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Fin</label>
                          <Input className="mt-1" type="time" value={fctFin} onChange={(e) => setFctFin(e.target.value)} />
                        </div>
                      </div>

                      <Button onClick={handleAddFCT} className="gap-2 w-full sm:w-auto text-xs">
                        <Plus className="h-4 w-4" />
                        Añadir FCT
                      </Button>

                      <Separator />

                      {fct.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No hay FCT registradas.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Día</TableHead>
                                <TableHead>Horario</TableHead>
                                <TableHead className="w-[80px] text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fct.map((t) => (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium">
                                    {DIAS.find((d) => d.value === t.diaSemana)?.label ?? t.diaSemana}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{t.horaInicio} — {t.horaFin}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteFCT(t.id)}
                                      aria-label="Eliminar FCT"
                                    >
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

                    <Separator className="my-4" />

                    {/* === Festivos === */}
                    <CardHeader>
                      <CardTitle>Festivos</CardTitle>
                      <CardDescription className="text-xs">
                        Crea días o rangos no lectivos con su motivo<br/>El calendario bloqueará la creación y movimiento de eventos en estas fechas.
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

                        <Button onClick={handleAddFestivo} disabled={!canSaveFestivo} className="gap-2 text-xs">
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
                              <TableRow className="text-xs">
                                <TableHead className="w-[180px]">Fecha</TableHead>
                                <TableHead>Motivo</TableHead>
                                <TableHead className="w-[80px] text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {festivos.map((f) => (
                                <TableRow key={f.id}>
                                  <TableCell className="font-medium text-xs">
                                    {f.end && f.end !== f.start ? (
                                      <Badge variant="secondary">{f.start} → {f.end}</Badge>
                                    ) : (
                                      <Badge variant="secondary">{f.start}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">{f.title}</TableCell>
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Columna derecha: Backups */}
      {/* Columna derecha: Backups (collapsible) */}
<div className="lg:col-span-1">
  <Collapsible open={openBackups} onOpenChange={setOpenBackups}>
    <Card className="border-muted/60 lg:sticky lg:top-6">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <div>
          <div className="flex items-center">
                <DatabaseBackup className="h-5 w-5 shrink-0 mr-2" aria-hidden="true" />
                  <CardTitle>Backups de bases de datos</CardTitle>
                  </div>
            <CardDescription className="ml-7 mt-1">
              Incrementales cada 20’ y completos cada hora.
            </CardDescription>
          </div>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {openBackups ? "Ocultar" : "Mostrar"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${openBackups ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </CardHeader>

      <CollapsibleContent>
        <CardContent className="pt-2">
          <BackupsCard />
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
</div>

    </div>
  </div>
</main>

  );
}
