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
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  startRecur?: string;
  endRecur?: string;
  classNames?: string[];
  editable?: boolean;
  display?: "auto" | "block" | "list-item" | "background" | "inverse-background" | "none";
  backgroundColor?: string;
  rrule?: any;
  duration?: string;
  extendedProps?: Record<string, any>;
};

type Props = {
  events?: FCEvent[];
  diasPermitidos?: number[];
  initialView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay";
  initialDate?: Date | string;
  slotMinTime?: string;
  slotMaxTime?: string;
  height?: number | "auto" | "parent";
  validRange?: { start: string; end: string };
  festivos?: Array<{ start: string; end?: string }>;
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
  } catch {
    return false;
  }
};

/* ===================== Componente ===================== */
export default function Calendario({
  events = [],
  diasPermitidos = [1, 2, 3, 4, 5],   // 👈 por defecto L-V
  initialView = "timeGridWeek",
  initialDate,
  slotMinTime = "08:00:00",            // 👈 arranca a las 08:00
  slotMaxTime = "19:00:00",            // 👈 termina a las 19:00
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

  // Sanea eventos para no caer en 00:00 → 08:00 fantasma
  const sanitizedEvents = React.useMemo<FCEvent[]>(() => {
    return (events ?? []).map((e) => {
      if (typeof e.start === "string") {
        if (isDateOnly(e.start) || isMidnight(e.start)) return { ...e, allDay: true };
      } else if (isMidnight(e.start)) {
        return { ...e, allDay: true };
      }
      return e;
    });
  }, [events]);

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
      locale={esLocale}
      timeZone="Europe/Madrid"
      initialView={initialView}
      initialDate={initialDate}
      height={height}
      allDaySlot={false}
      firstDay={1}
      weekends={false}                 // 👈 no mostrar fines de semana
      hiddenDays={hiddenDays}          // 👈 refuerzo (oculta Dom/Sáb)
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
      events={sanitizedEvents as any}
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
        onEventMove?.({ id: info.event.id, start, end });
      }}
      eventResize={(info) => {
        const start = info.event.start!;
        const end = info.event.end ?? start;
        if (!dentroDeRango(start) || !dentroDeRango(end)) {
          info.revert();
          return;
        }
        onEventResize?.({ id: info.event.id, start, end });
      }}
    />
  );
}
