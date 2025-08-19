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

import type { Festivo, Presencialidad, FCTTramo } from "@/types/electronAPI";

/* ---------- utils ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  
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

// ===== util tramos (presencialidad/FCT) =====
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const solapanRangosMin = (aIni: number, aFin: number, bIni: number, bFin: number) =>
  aIni < bFin && bIni < aFin;

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

  const pad = (n: number) => String(n).padStart(2, "0");

  while (cursor <= end) {
    const dow = cursor.getDay();
    horarios.forEach((h) => {
      if (dow === h.diaSemana && !esDiaFestivo(cursor, festivos)) {
        const fecha = ymdLocal(cursor); // YYYY-MM-DD

        // normalizamos HH:mm → HH:mm:ss
        const hi = h.horaInicio.length === 5 ? `${h.horaInicio}:00` : h.horaInicio;
        const hf = h.horaFin.length === 5 ? `${h.horaFin}:00` : h.horaFin;

        out.push({
          id: `horario-${cursoId}-${asigId}-${fecha}-${h.horaInicio}`,
          title: titulo,
          start: `${fecha}T${hi}`,  // ✅ siempre YYYY-MM-DDTHH:mm:ss
          end:   `${fecha}T${hf}`,
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


/** Expandir TRAMOS (presencialidad/FCT) a background events */
const expandirTramosBG = (
  tramos: Array<{ diaSemana:number; horaInicio:string; horaFin:string }>,
  start: Date,
  end: Date,
  className: string
): FCEvent[] => {
  const out: FCEvent[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();     // 0..6 (L=1)
    const fecha = ymdLocal(cursor);  // YYYY-MM-DD
    tramos.forEach((t, i) => {
      const jsDow = t.diaSemana % 7; // 1..5 -> 1..5 (si usas 0..6 sirve igual)
      if (dow === jsDow) {
        out.push({
          id: `${className}-${fecha}-${i}`,
          start: `${fecha}T${t.horaInicio}:00`,
          end:   `${fecha}T${t.horaFin}:00`,
          display: "background",
          editable: false,
          classNames: [className],
          backgroundColor:
            className === "fct-bg" ? "rgba(200,120,255,0.26)" :
            className === "presencial-bg" ? "rgba(120,160,255,0.28)" :
            undefined,
          title: "",
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
  const [fct, setFct] = useState<FCTTramo[]>([]);

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

  /* -------- Leer rango lectivo + festivos + presencialidades + FCT -------- */
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

      try {
        const t = await window.electronAPI.listarFCT?.();
        if (!alive) return;
        setFct(t || []);
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
        let eventosFCTBG: FCEvent[] = [];

        if (rangoValido && lectivoStartDate && lectivoEndDate) {
          // HORARIOS (excluyendo festivos)
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

          // PRESENCIALIDADES y FCT como background
          eventosPresencialBG = expandirTramosBG(presencialidades || [], lectivoStartDate, lectivoEndDate, "presencial-bg");
          eventosFCTBG        = expandirTramosBG(fct || [],               lectivoStartDate, lectivoEndDate, "fct-bg");
        }

        // ACTIVIDADES programadas (filtradas por rango y excluyendo festivos)
        const actividadesPorCurso = await Promise.all(
          cursos.map(async (c: any) => {
            const acts = await window.electronAPI.actividadesDeCurso(c.id);
            return (acts || [])
              .filter((a: any) => a.estado === "programada")
              .map((a: any) => {
                // fuentes posibles
                const startFromDb: string | undefined = a.programada_para;  // "YYYY-MM-DDTHH:mm:ss"
                const endFromDb:   string | undefined = a.programada_fin;
              
                // fallback (compat actividades antiguas)
                let start = startFromDb;
                let end   = endFromDb;
              
                if (!start) {
                  if (a.start_ms) {
                    start = toLocalISO(new Date(a.start_ms));
                  } else if (a.fecha && a.horaInicio) {
                    start = `${a.fecha}T${a.horaInicio}:00`;
                  } else if (a.fecha) {
                    // último recurso para no perder el evento en pantalla
                    start = `${a.fecha}T08:00:00`;
                  }
                }
              
                if (!end) {
                  if (a.end_ms) {
                    end = toLocalISO(new Date(a.end_ms));
                  } else if (a.fecha && a.horaFin) {
                    end = `${a.fecha}T${a.horaFin}:00`;
                  }
                }
              
                return {
                  id: a.id,
                  title: `${a.nombre} · ${c.nombre}`,
                  start,
                  end,
                  allDay: false,
                  extendedProps: { estado: a.estado },
                } as Evento;
              })
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
        setEvents([
          ...eventosHorarios,
          ...actividades,
          ...eventosFestivos,
          ...eventosPresencialBG,
          ...eventosFCTBG, // ⬅️ AÑADIDO
        ]);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar horarios y actividades.");
      }
    })();
    return () => { alive = false; };
  }, [refreshKey, rangoValido, lectivoStartISO, lectivoEndISO, festivos, presencialidades, fct]); // ⬅️ depende de FCT

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

  const libreDeTramos = useCallback(
    (start: Date, end: Date, tramos: Array<{ diaSemana:number; horaInicio:string; horaFin:string }>) => {
      if (start.toDateString() !== end.toDateString()) return true;
      const dow = start.getDay();
      const ini = start.getHours() * 60 + start.getMinutes();
      const fin = end.getHours() * 60 + end.getMinutes();
      return (tramos || []).every((t) => {
        const jsDow = t.diaSemana % 7;
        if (dow !== jsDow) return true;
        return !solapanRangosMin(ini, fin, toMinutes(t.horaInicio), toMinutes(t.horaFin));
      });
    },
    []
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
      const fin = new Date(date); fin.setMinutes(fin.getMinutes() + 30);
      if (!libreDeTramos(date, fin, presencialidades)) {
        toast.warning("No se pueden crear actividades durante presencialidades.");
        return;
      }
      if (!libreDeTramos(date, fin, fct)) {
        toast.warning("No se pueden crear actividades durante FCT.");
        return;
      }
      setFechaPreseleccionada(date);
      setOpenDialog(true);
    },
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo, libreDeTramos, presencialidades, fct]
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
      if (!libreDeTramos(start, fin, presencialidades)) {
        toast.error("No puedes mover la actividad a una presencialidad.");
        setRefreshKey((k) => k + 1);
        return;
      }
      if (!libreDeTramos(start, fin, fct)) {
        toast.error("No puedes mover la actividad a una franja FCT.");
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
    [rangoValido, lectivoStartDate, lectivoEndDate, libreDeFestivo, libreDeTramos, presencialidades, fct]
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
            diasPermitidos={[1,2,3,4,5]}
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
          .fc .presencial-bg    { background: rgba(120, 160, 255, 0.12); }
          .fc .fct-bg           { background: rgba(200, 120, 255, 0.16); } /* ⬅️ NUEVO */
        `}</style>
      </SidebarInset>
    </SidebarProvider>
  );
}
