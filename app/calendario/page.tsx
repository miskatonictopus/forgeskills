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

import type { Festivo, Presencialidad } from "@/types/electronAPI";

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

const esDiaFestivo = (fecha: Date, festivos: Festivo[]) => {
  const t = new Date(ymdLocal(fecha) + "T12:00:00").getTime();
  return festivos.some((f) => {
    const s = new Date((f.start ?? ymdLocal(fecha)) + "T00:00:00").getTime();
    const e = new Date(((f.end ?? f.start) ?? f.start) + "T23:59:59").getTime();
    return t >= s && t <= e;
  });
};

// ===== util presencialidades =====
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const solapanRangosMin = (aIni: number, aFin: number, bIni: number, bFin: number) =>
  aIni < bFin && bIni < aFin;

/** ¿La fecha/hora cae en una presencialidad? (usa weekday y hora) */
const caeEnPresencialidad = (fecha: Date, presencialidades: Presencialidad[]) => {
  const dow = fecha.getDay(); // 0..6 (Dom=0)
  const mins = fecha.getHours() * 60 + fecha.getMinutes();
  return presencialidades.some((p) => {
    // si usas 1..5 (L=1) en BBDD, convertimos:
    const pDow = p.diaSemana; // 1..5 (L..V)
    const jsDow = ((pDow % 7) as number); // L=1 -> 1, etc. (Dom=0)
    if (dow !== jsDow) return false;
    const ini = toMinutes(p.horaInicio);
    const fin = toMinutes(p.horaFin);
    return mins >= ini && mins < fin;
  });
};

/** Expandir horarios semanales a eventos concretos (excluye festivos) */
const expandirHorariosEnRango = (
  horarios: Array<{ diaSemana: number; horaInicio: string; horaFin: string }>,
  start: Date,
  end: Date,
  titulo: string,
  cursoId: string,
  asigId: string,
  festivos: Festivo[]
): Evento[] => {
  const out: Evento[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    horarios.forEach((h) => {
      if (dow === h.diaSemana && !esDiaFestivo(cursor, festivos)) {
        const fecha = ymdLocal(cursor);
        out.push({
          id: `horario-${cursoId}-${asigId}-${fecha}-${h.horaInicio}`,
          title: titulo,
          start: `${fecha}T${h.horaInicio}:00`,
          end: `${fecha}T${h.horaFin}:00`,
          classNames: ["horario-event"],
          backgroundColor: "rgba(120,160,255,0.28)",
          editable: false,
        });
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

/** Expandir PRESENCIALIDADES a background events por cada día (NO lectivos) */
const expandirPresencialidadesEnRango = (
  pres: Presencialidad[],
  start: Date,
  end: Date
): FCEvent[] => {
  const out: FCEvent[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay(); // 0..6 (Dom=0)
    const fecha = ymdLocal(cursor);
    pres.forEach((p, i) => {
      // En BBDD guardamos 1..5 (L..V). JS: 1..5 es L..V también.
      // Si algún día grabas 0=Domingo, esto sigue funcionando por el % 7:
      const jsDow = p.diaSemana % 7; // 1->1, 5->5, 0->0
      if (dow === jsDow) {
        out.push({
          id: `presencial-${fecha}-${i}`,
          start: `${fecha}T${p.horaInicio}:00`,
          end: `${fecha}T${p.horaFin}:00`,
          allDay: false,                // ⬅️ asegura time-grid (no all-day)
          display: "background",
          editable: false,
          classNames: ["presencial-bg"], // el color lo forzamos por CSS
          title: "",                     // sin texto
        });
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

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
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [presencialidades, setPresencialidades] = useState<Presencialidad[]>([]);

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

  /* -------- Leer rango lectivo + festivos + presencialidades -------- */
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
        const f = await window.electronAPI.listarFestivos();
        if (!alive) return;
        setFestivos(f);
      } catch {}

      try {
        const p = await window.electronAPI.listarPresencialidades?.();
        if (!alive) return;
        setPresencialidades(p || []);
      } catch {}
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  /* -------- Cargar horarios + actividades + no lectivos (limitados al rango) -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cursos = await window.electronAPI.leerCursos();

        // Festivos como background
        const eventosFestivos: FCEvent[] = (festivos || []).map((f) => ({
          id: `festivo-${f.id}`,
          title: f.title,
          start: `${f.start}T00:00:00`,
          end: f.end ? `${f.end}T23:59:59` : undefined,
          display: "background",
          classNames: ["festivo-background"],
          editable: false,
        }));

        const eventosHorarios: Evento[] = [];
        let eventosPresencialBG: FCEvent[] = [];

        if (rangoValido && lectivoStartDate && lectivoEndDate) {
          // Expandimos HORARIOS (excluyendo festivos)
          for (const c of cursos) {
            const asigs = await window.electronAPI.asignaturasDeCurso(c.id);
            for (const a of asigs) {
              const hrs = await window.electronAPI.getHorariosAsignatura(c.id, a.id);
              if (!hrs || hrs.length === 0) continue;
              const titulo = `${a.nombre} · ${c.nombre}`;
              eventosHorarios.push(
                ...expandirHorariosEnRango(
                  hrs.map((h: any) => ({
                    diaSemana: h.diaSemana,
                    horaInicio: h.horaInicio,
                    horaFin: h.horaFin,
                  })),
                  lectivoStartDate,
                  lectivoEndDate,
                  titulo,
                  c.id,
                  a.id,
                  festivos || []
                )
              );
            }
          }

          // Expandimos PRESENCIALIDADES como background (no lectivo)
          eventosPresencialBG = expandirPresencialidadesEnRango(
            presencialidades || [],
            lectivoStartDate,
            lectivoEndDate
          );
        }

        // ACTIVIDADES programadas (filtradas por rango y excluyendo festivos)
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
        let actividades = actividadesPorCurso.flat();

        if (rangoValido && lectivoStartDate && lectivoEndDate) {
          actividades = actividades.filter((e) => {
            if (!e.start) return false;
            const d = new Date(e.start);
            return between(lectivoStartDate, d, lectivoEndDate) && !esDiaFestivo(d, festivos || []);
          });
        }

        if (!alive) return;
        setEvents([...eventosHorarios, ...actividades, ...eventosFestivos, ...eventosPresencialBG]);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar horarios y actividades.");
      }
    })();
    return () => { alive = false; };
  }, [refreshKey, rangoValido, lectivoStartISO, lectivoEndISO, festivos, presencialidades]);

  /* -------- Crear / mover actividades respetando NO lectivos -------- */
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

  const libreDePresencialidad = useCallback(
    (start: Date, end: Date) => {
      // mismo día
      if (start.toDateString() !== end.toDateString()) return true;
      const dow = start.getDay();
      const ini = start.getHours() * 60 + start.getMinutes();
      const fin = end.getHours() * 60 + end.getMinutes();
      return (presencialidades || []).every((p) => {
        const jsDow = p.diaSemana;
        if (dow !== jsDow) return true;
        return !solapanRangosMin(ini, fin, toMinutes(p.horaInicio), toMinutes(p.horaFin));
      });
    },
    [presencialidades]
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
      // bloqueamos creación dentro de presencialidad
      const fin = new Date(date); fin.setMinutes(fin.getMinutes() + 30);
      if (!libreDePresencialidad(date, fin)) {
        toast.warning("No se pueden crear actividades durante presencialidades.");
        return;
      }
      setFechaPreseleccionada(date);
      setOpenDialog(true);
    },
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo, libreDePresencialidad]
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
      const fin = new Date(start); fin.setMinutes(fin.getMinutes() + 30);
      if (!libreDePresencialidad(start, fin)) {
        toast.error("No puedes mover la actividad a una presencialidad.");
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
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo, libreDePresencialidad]
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
            festivos={festivos.map((f) => ({ start: f.start, end: f.end ?? undefined }))}
          />

          <DialogCrearActividad
            open={openDialog}
            onOpenChange={setOpenDialog}
            setRefreshKey={setRefreshKey}
            fechaInicial={fechaPreseleccionada}
          />
        </div>

        {/* estilos para background */}
        <style jsx global>{`
          .fc .festivo-background { background: rgba(80, 200, 120, 0.12); }
          .fc .presencial-bg { background: rgba(120, 160, 255, 0.12); }
        `}</style>
      </SidebarInset>
    </SidebarProvider>
  );
}
