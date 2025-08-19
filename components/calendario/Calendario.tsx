"use client";

import React from "react";
import dynamic from "next/dynamic";

// FullCalendar (React wrapper sin SSR)
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });

// Plugins
import esLocale from "@fullcalendar/core/locales/es";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import rrulePlugin from "@fullcalendar/rrule";

/* ===================== Tipos ===================== */
export type FCEvent = {
  id: string;
  title: string;
  start?: string | Date;
  end?: string | Date;
  allDay?: boolean;

  // recurrentes
  daysOfWeek?: number[];   // 0..6
  startTime?: string;      // "HH:mm"
  endTime?: string;        // "HH:mm"
  startRecur?: string;
  endRecur?: string;

  // estilo / control
  classNames?: string[];
  editable?: boolean;
  display?: "auto" | "block" | "list-item" | "background" | "inverse-background" | "none";
  backgroundColor?: string;

  // rrule opcional
  rrule?: any;
  duration?: string;
  extendedProps?: Record<string, any>;
};

type Props = {
  events?: FCEvent[];
  /** 0=Dom .. 6=Sáb. Si lo pasas, bloqueamos creación/movimiento fuera de estos días */
  diasPermitidos?: number[];
  /** Vista inicial */
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
  /** Fecha inicial del calendario */
  initialDate?: Date | string;
  /** Límite inferior/superior del horario visible (HH:mm:ss) */
  slotMinTime?: string;
  slotMaxTime?: string;
  /** Alto del calendario. Por defecto "auto" */
  height?: number | "auto" | "parent";
  /** Rango lectivo (YYYY-MM-DD) */
  validRange?: { start: string; end: string };
  festivos?: Array<{ start: string; end?: string }>;
  /** Callbacks */
  onDateClick?: (date: Date) => void;
  onSelectRange?: (start: Date, end: Date) => void;
  onEventMove?: (e: { id: string; start: Date; end?: Date }) => void;
  onEventResize?: (e: { id: string; start: Date; end?: Date }) => void;
};

/* ===================== Helpers ===================== */
const parseISODate = (iso: string) => new Date(`${iso}T00:00:00`);
const parseISOEndDay = (iso: string) => new Date(`${iso}T23:59:59`);
const between = (start: Date, d: Date, end: Date) => start <= d && d <= end;

const isDateOnly = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMidnight = (start?: string | Date) => {
  if (!start) return false;
  if (typeof start === "string") return /T00:00(:00)?$/.test(start);
  try {
    return start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0;
  } catch { return false; }
};

/* ===================== Componente ===================== */
export default function Calendario({
  events = [],
  diasPermitidos,
  initialView = "timeGridWeek",
  initialDate,
  slotMinTime = "08:00:00",
  slotMaxTime = "20:00:00",
  height = "auto",
  validRange,
  festivos,
  onDateClick,
  onSelectRange,
  onEventMove,
  onEventResize,
}: Props) {
  const setPermitidos = React.useMemo(
    () => (diasPermitidos && diasPermitidos.length > 0 ? new Set(diasPermitidos) : null),
    [diasPermitidos]
  );

  const hiddenDays = React.useMemo(() => {
    if (!diasPermitidos) return undefined;
    const all = [0, 1, 2, 3, 4, 5, 6];
    return all.filter((d) => !diasPermitidos.includes(d));
  }, [diasPermitidos]);

  const rangoStart = React.useMemo(
    () => (validRange?.start ? parseISODate(validRange.start) : undefined),
    [validRange?.start]
  );
  const rangoEnd = React.useMemo(
    () => (validRange?.end ? parseISOEndDay(validRange.end) : undefined),
    [validRange?.end]
  );

  const dentroDeRango = React.useCallback(
    (d: Date) => (!rangoStart || !rangoEnd ? true : between(rangoStart, d, rangoEnd)),
    [rangoStart, rangoEnd]
  );

  const selectAllow = React.useCallback(
    (info: any) => {
      const dayOk = setPermitidos ? setPermitidos.has(info.start.getDay()) : true;
      const rangoOk = dentroDeRango(info.start) && dentroDeRango(info.end ?? info.start);
      return dayOk && rangoOk;
    },
    [setPermitidos, dentroDeRango]
  );

  const eventAllow = React.useCallback(
    (dropInfo: any) => {
      const dayOk = setPermitidos ? setPermitidos.has(dropInfo.start.getDay()) : true;
      const rangoOk = dentroDeRango(dropInfo.start) && dentroDeRango(dropInfo.end ?? dropInfo.start);
      return dayOk && rangoOk;
    },
    [setPermitidos, dentroDeRango]
  );

  // 🔧 Sanea eventos para evitar el “08:00 fantasma”
  const sanitizedEvents = React.useMemo<FCEvent[]>(() => {
    const base = (events ?? [])
      .filter((e) => !!e?.start)
      .map((e) => {
        const estado = (e as any)?.extendedProps?.estado;
        if (estado === "programada") return e; // ya tiene hora real

        // Si llega "YYYY-MM-DD" o medianoche → pásalo a allDay (y con allDaySlot=false no se ve)
        if (typeof e.start === "string") {
          if (isDateOnly(e.start) || isMidnight(e.start)) return { ...e, allDay: true };
        } else if (isMidnight(e.start)) {
          return { ...e, allDay: true };
        }
        return e;
      });

    // Festivos como background (opcional)
    const festivosBg: FCEvent[] = (festivos ?? []).map((f, idx) => ({
      id: `festivo-${idx}`,
      title: "",
      start: f.start,
      end: f.end,
      display: "background",
      classNames: ["festivo-background"],
      backgroundColor: "rgba(80,200,120,0.20)",
    }));

    return [...base, ...festivosBg];
  }, [events, festivos]);

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
      locale={esLocale}
      timeZone="local"
      initialView={initialView}
      initialDate={initialDate}
      height={height}
      allDaySlot={false}
      firstDay={1}
      weekends={false}
      hiddenDays={hiddenDays}
      nowIndicator={true}
      slotMinTime={slotMinTime}
      slotMaxTime={slotMaxTime}
      expandRows={true}
      stickyHeaderDates={true}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      validRange={validRange}
      selectable
      selectMirror
      editable
      eventStartEditable
      eventDurationEditable
      selectAllow={selectAllow}
      eventAllow={eventAllow}

      // ⬇️ Usamos los eventos saneados
      events={sanitizedEvents as any}

      // ⬇️ Refuerzo: si algo se cuela sin pasar por arriba, lo transformamos aquí también
      eventDataTransform={(raw: any) => {
        const e = { ...raw };
        const estado = e.extendedProps?.estado;
        if (estado !== "programada") {
          const s = typeof e.start === "string" ? e.start : undefined;
          if (isDateOnly(s) || isMidnight(e.start)) {
            e.allDay = true;         // se oculta en timeGrid por allDaySlot=false
            e.end = e.start;         // evita ensanches
          }
        }
        return e;
      }}

      /* ⬇️ Colores de background (presencialidades/festivos/FCT) */
      eventClassNames={(arg) => arg.event.classNames}
      eventDidMount={(info) => {
        if (info.event.display === "background") {
          let color =
            (info.event as any).backgroundColor ||
            (info.event as any)._def?.ui?.backgroundColor ||
            "";

          if (!color && info.event.classNames?.includes("presencial-bg")) {
            color = "rgba(120,160,255,0.28)";
          }
          if (!color && info.event.classNames?.includes("festivo-background")) {
            color = "rgba(80,200,120,0.20)";
          }
          if (!color && info.event.classNames?.includes("fct-bg")) {
            color = "rgba(200,120,255,0.26)";
          }
          if (!color) color = "rgba(180,180,180,0.18)";

          const el = info.el as HTMLElement;
          el.style.backgroundColor = color;
          el.style.opacity = "1";
        }
      }}

      dateClick={(info) => {
        if (setPermitidos && !setPermitidos.has(info.date.getDay())) return;
        if (!dentroDeRango(info.date)) return;
        onDateClick?.(info.date);
      }}
      select={(info) => {
        if (setPermitidos && !setPermitidos.has(info.start.getDay())) return;
        if (!dentroDeRango(info.start) || !dentroDeRango(info.end)) return;
        onSelectRange?.(info.start, info.end);
      }}
      eventDrop={(info) => {
        const start = info.event.start!;
        const end = info.event.end ?? start;
        if (setPermitidos && !setPermitidos.has(start.getDay())) {
          info.revert();
          return;
        }
        if (!dentroDeRango(start) || !dentroDeRango(end)) {
          info.revert();
          return;
        }
        onEventMove?.({ id: info.event.id, start, end: info.event.end ?? undefined });
      }}
      eventResize={(info) => {
        const start = info.event.start!;
        const end = info.event.end ?? start;
        if (!dentroDeRango(start) || !dentroDeRango(end)) {
          info.revert();
          return;
        }
        onEventResize?.({ id: info.event.id, start, end: info.event.end ?? undefined });
      }}
    />
  );
}
