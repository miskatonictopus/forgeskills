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
      events={events as any} // ⬅️ PASAMOS TAL CUAL (incluye display/backgroundColor/classNames)

      /* ⬇️ Forzamos visibilidad de background events (presencialidades/festivos/FCT) */
      eventClassNames={(arg) => arg.event.classNames}
      eventDidMount={(info) => {
        if (info.event.display === "background") {
          // 1) usa el color del evento si viene definido
          let color =
            (info.event as any).backgroundColor ||
            (info.event as any)._def?.ui?.backgroundColor ||
            "";

          // 2) si no viene, decide por clase
          if (!color && info.event.classNames?.includes("presencial-bg")) {
            color = "rgba(120,160,255,0.28)";
          }
          if (!color && info.event.classNames?.includes("festivo-background")) {
            color = "rgba(80,200,120,0.20)";
          }
          if (!color && info.event.classNames?.includes("fct-bg")) {
            color = "rgba(200,120,255,0.26)"; // ⬅️ NUEVO: FCT
          }

          // 3) fallback general
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
        onEventMove?.({
          id: info.event.id,
          start,
          end: info.event.end ?? undefined,
        });
      }}
      eventResize={(info) => {
        const start = info.event.start!;
        const end = info.event.end ?? start;
        if (!dentroDeRango(start) || !dentroDeRango(end)) {
          info.revert();
          return;
        }
        onEventResize?.({
          id: info.event.id,
          start,
          end: info.event.end ?? undefined,
        });
      }}
    />
  );
}
