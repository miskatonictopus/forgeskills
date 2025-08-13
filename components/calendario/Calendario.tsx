"use client";

import React from "react";
import dynamic from "next/dynamic";

// FullCalendar (React wrapper sin SSR)
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });

// Estilos de FullCalendar (solo aquí, para no tocar Tailwind global)

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

  // ➕ para eventos recurrentes tipo timeGrid
  daysOfWeek?: number[];   // 0..6
  startTime?: string;      // "HH:mm"
  endTime?: string;        // "HH:mm"
  startRecur?: string;
  endRecur?: string;

  // ➕ estilado / control
  classNames?: string[];   // <— esto quita tu error
  editable?: boolean;
  display?: "auto" | "block" | "list-item" | "background" | "inverse-background" | "none";
  backgroundColor?: string;

  // si usas rrule
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
  /** Callbacks */
  onDateClick?: (date: Date) => void;
  onSelectRange?: (start: Date, end: Date) => void;
  onEventMove?: (e: { id: string; start: Date; end?: Date }) => void;
  onEventResize?: (e: { id: string; start: Date; end?: Date }) => void;
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
  onDateClick,
  onSelectRange,
  onEventMove,
  onEventResize,
}: Props) {
  const setPermitidos = React.useMemo(
    () => (diasPermitidos && diasPermitidos.length > 0 ? new Set(diasPermitidos) : null),
    [diasPermitidos]
  );

  const selectAllow = React.useCallback(
    (info: any) => (setPermitidos ? setPermitidos.has(info.start.getDay()) : true),
    [setPermitidos]
  );

  const eventAllow = React.useCallback(
    (dropInfo: any) => (setPermitidos ? setPermitidos.has(dropInfo.start.getDay()) : true),
    [setPermitidos]
  );

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
      locale={esLocale}
      timeZone="local"
      initialView={initialView}
      initialDate={initialDate}
      height={height}
      firstDay={1}            // Lunes
      weekends={false}
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
      selectable
      selectMirror
      editable
      eventStartEditable
      eventDurationEditable
      selectAllow={selectAllow}
      eventAllow={eventAllow}
      events={events as any}
      dateClick={(info) => {
        if (setPermitidos && !setPermitidos.has(info.date.getDay())) return;
        onDateClick?.(info.date);
      }}
      select={(info) => {
        if (setPermitidos && !setPermitidos.has(info.start.getDay())) return;
        onSelectRange?.(info.start, info.end);
      }}
      eventDrop={(info) => {
        if (setPermitidos && !setPermitidos.has(info.event.start!.getDay())) {
          info.revert();
          return;
        }
        onEventMove?.({
          id: info.event.id,
          start: info.event.start!,
          end: info.event.end ?? undefined,
        });
      }}
      eventResize={(info) => {
        onEventResize?.({
          id: info.event.id,
          start: info.event.start!,
          end: info.event.end ?? undefined,
        });
      }}
    />
  );
}
