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
import { toast } from "sonner";

import type { FCEvent } from "@/components/calendario/Calendario";
import Calendario, { FCEvent as Evento } from "@/components/calendario/Calendario";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";

// Stores para hidratar el sidebar
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

/* ---------- utils ---------- */
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const between = (start: Date, d: Date, end: Date) => start <= d && d <= end;
const toDateStart = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : undefined);
const toDateEnd = (iso?: string) => (iso ? new Date(`${iso}T23:59:59`) : undefined);

export default function CalendarioGlobalPage() {
  /* -------- Rango lectivo (solo lectura) -------- */
  const [lectivoStartISO, setLectivoStartISO] = useState<string | undefined>(undefined);
  const [lectivoEndISO, setLectivoEndISO] = useState<string | undefined>(undefined);
  const lectivoStartDate = useMemo(() => toDateStart(lectivoStartISO), [lectivoStartISO]);
  const lectivoEndDate = useMemo(() => toDateEnd(lectivoEndISO), [lectivoEndISO]);
  const rangoValido =
    !!lectivoStartDate && !!lectivoEndDate && lectivoStartDate < lectivoEndDate;

  /* -------- Eventos -------- */
  const [events, setEvents] = useState<FCEvent[]>([]);
  const [diasPermitidos] = useState<number[] | undefined>([1, 2, 3, 4, 5]); // L–V
  const [festivos, setFestivos] = useState<{ id?: string; title: string; start: string; end?: string }[]>(
    []
  );

  const [openDialog, setOpenDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fechaPreseleccionada, setFechaPreseleccionada] = useState<Date | undefined>(undefined);

  /* -------- Sidebar: cursos + asignaturas -------- */
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

  /* -------- Leer rango lectivo + festivos -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await window.electronAPI.leerRangoLectivo?.();
        if (!alive) return;
        setLectivoStartISO(r?.start);
        setLectivoEndISO(r?.end);
      } catch {}
      try {
        const f = await window.electronAPI.listarFestivos?.();
        if (!alive) return;
        if (Array.isArray(f)) setFestivos(f);
      } catch {}
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  /* -------- Cargar horarios + actividades (limitados al rango) -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cursos = await window.electronAPI.leerCursos();

        // Horarios recurrentes
        const eventosHorarios: Evento[] = [];
        for (const c of cursos) {
          const asigs = await window.electronAPI.asignaturasDeCurso(c.id);
          for (const a of asigs) {
            const hrs = await window.electronAPI.getHorariosAsignatura(c.id, a.id);
            for (const h of hrs || []) {
              eventosHorarios.push({
                id: `horario-${c.id}-${a.id}-${h.diaSemana}-${h.horaInicio}`,
                title: `${a.nombre} · ${c.nombre}`,
                daysOfWeek: [h.diaSemana],
                startTime: h.horaInicio,
                endTime: h.horaFin,
                classNames: ["horario-event"],
                editable: false,
                ...(rangoValido && lectivoStartISO && lectivoEndISO
                  ? { startRecur: lectivoStartISO, endRecur: lectivoEndISO }
                  : {}),
              });
            }
          }
        }

        // Actividades programadas (filtradas por rango)
        const actividadesPorCurso = await Promise.all(
          cursos.map(async (c: any) => {
            const acts = await window.electronAPI.actividadesDeCurso(c.id);
            return (acts || [])
              .filter((a: any) => a.estado === "programada")
              .map((a: any) => ({
                id: a.id,
                title: `${a.nombre} · ${c.nombre}`,
                start: `${a.fecha}T${a.horaInicio ? a.horaInicio + ":00" : "08:00:00"}`,
                end: a.horaFin ? `${a.fecha}T${a.horaFin}:00` : undefined,
              })) as Evento[];
          })
        );
        const actividades = actividadesPorCurso.flat();

        const actividadesFiltradas =
          rangoValido && lectivoStartDate && lectivoEndDate
            ? actividades.filter((e) => (e.start ? between(lectivoStartDate, new Date(e.start), lectivoEndDate) : false))
            : actividades;

        // Festivos como background
        const eventosFestivos: FCEvent[] = (festivos || []).map((f, idx) => ({
          id: f.id ?? `festivo-${idx}`,
          title: f.title,
          start: `${f.start}T00:00:00`,
          end: f.end ? `${f.end}T23:59:59` : undefined,
          display: "background",
          classNames: ["festivo-background"],
          editable: false,
        }));

        if (!alive) return;
        setEvents([...eventosHorarios, ...actividadesFiltradas, ...eventosFestivos]);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar horarios y actividades.");
      }
    })();
    return () => { alive = false; };
  }, [refreshKey, rangoValido, lectivoStartISO, lectivoEndISO, festivos]);

  /* -------- Crear / mover actividades respetando rango + festivos -------- */
  const libreDeFestivo = useCallback(
    (start: Date, end: Date) => {
      const ranges = (festivos || []).map((f) => ({
        s: new Date(`${f.start}T00:00:00`),
        e: new Date(`${(f.end ?? f.start)}T23:59:59`),
      }));
      return ranges.every((fr) => !(start < fr.e && fr.s < end));
    },
    [festivos]
  );

  const handleCreate = useCallback(
    (date: Date) => {
      if (!rangoValido || !lectivoStartDate || !lectivoEndDate) {
        toast.warning("Define el periodo lectivo en Configuración para crear actividades.");
        return;
      }
      if (!between(lectivoStartDate, date, lectivoEndDate)) {
        toast.warning("Fecha fuera del periodo lectivo.");
        return;
      }
      if (!libreDeFestivo(date, date)) {
        toast.warning("No se pueden crear actividades en festivos.");
        return;
      }
      setFechaPreseleccionada(date);
      setOpenDialog(true);
    },
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo]
  );

  const handleMove = useCallback(
    async ({ id, start }: { id: string; start: Date }) => {
      if (!rangoValido || !lectivoStartDate || !lectivoEndDate) {
        toast.warning("Define el periodo lectivo en Configuración para reprogramar.");
        setRefreshKey((k) => k + 1);
        return;
      }
      if (!between(lectivoStartDate, start, lectivoEndDate)) {
        toast.error("No puedes mover la actividad fuera del periodo lectivo.");
        setRefreshKey((k) => k + 1);
        return;
      }
      if (!libreDeFestivo(start, start)) {
        toast.error("No puedes mover la actividad a un día festivo.");
        setRefreshKey((k) => k + 1);
        return;
      }

      try {
        const nuevaFecha = ymdLocal(start);
        await window.electronAPI.actualizarActividadFecha(id, nuevaFecha);
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, start: `${nuevaFecha}T08:00:00` } : e))
        );
        toast.success("Actividad reprogramada.");
      } catch (e) {
        console.error(e);
        toast.error("No se pudo reprogramar la actividad.");
        setRefreshKey((k) => k + 1);
      }
    },
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo]
  );

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
                  <BreadcrumbLink href="/calendario">Calendario</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Contenido */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Calendario global</h1>
            <Button onClick={() => setOpenDialog(true)}>Nueva actividad</Button>
          </div>

          {/* Info del rango lectivo (solo lectura) */}
          {rangoValido ? (
            <div className="text-sm text-muted-foreground">
              Lectivo: <span className="font-medium">{lectivoStartISO}</span> →{" "}
              <span className="font-medium">{lectivoEndISO}</span>
            </div>
          ) : (
            <div className="text-sm text-destructive">
              No hay periodo lectivo activo. Ve a <span className="font-medium">Configuración</span> para definirlo.
            </div>
          )}

          <Calendario
            events={events}
            diasPermitidos={diasPermitidos}
            initialView="timeGridWeek"
            onDateClick={handleCreate}
            onEventMove={handleMove}
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            height="auto"
            validRange={
              rangoValido && lectivoStartISO && lectivoEndISO
                ? { start: lectivoStartISO, end: lectivoEndISO }
                : undefined
            }
            festivos={festivos.map((f) => ({ start: f.start, end: f.end }))}
          />

          <DialogCrearActividad
            open={openDialog}
            onOpenChange={setOpenDialog}
            setRefreshKey={setRefreshKey}
            fechaInicial={fechaPreseleccionada}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
