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
  borderColor?: string;
  textColor?: string;
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
const normalizeHex = (v?: string | null) => {
  if (!v) return "";
  let s = v.trim().toLowerCase();
  if (!s) return "";
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/i.test(s) ? s : "";
};
const textOn = (hex: string) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    return L > 0.6 ? "#111" : "#fff";
  } catch {
    return "#fff";
  }
};

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
  diasPermitidos = [1, 2, 3, 4, 5],
  initialView = "timeGridWeek",
  initialDate,
  slotMinTime = "08:00:00",
  slotMaxTime = "19:00:00",
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

  // Sanea eventos todo-día o 00:00
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
    <>
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

        /* ✅ Fuerza el color desde extendedProps.__color o backgroundColor */
        eventDidMount={(info) => {
          const el = info.el as HTMLElement;
          const ep = (info.event.extendedProps ?? {}) as any;

          const raw =
            ep.__color ||
            ep.color ||
            (typeof info.event.backgroundColor === "string" ? info.event.backgroundColor : "") ||
            "";

          const hex = normalizeHex(raw);
          if (!hex) return;

          const fg = textOn(hex);

          // 1) Actualiza el modelo de FC (sin getProp)
          try {
            info.event.setProp("backgroundColor", hex);
            info.event.setProp("borderColor", hex);
            info.event.setProp("textColor", fg);
          } catch {}

          // 2) Refuerzo visual por si el tema pisa estilos
          el.style.setProperty("--fc-event-bg-color", hex);
          el.style.setProperty("--fc-event-border-color", hex);
          el.style.setProperty("--fc-event-text-color", fg);
          el.style.backgroundColor = hex;
          el.style.borderColor = hex;
          el.style.color = fg;
        }}

        /* 🛟 Fallback: si aún así el tema lo pisa, coloreamos el contenido */
        eventContent={(arg: any) => {
          const ep = (arg.event.extendedProps ?? {}) as any;
          const raw =
            ep.__color ||
            ep.color ||
            (typeof arg.event.backgroundColor === "string" ? arg.event.backgroundColor : "") ||
            "";
          const hex = normalizeHex(raw);
          if (!hex) return undefined;

          const fg = textOn(hex);
          const wrap = document.createElement("div");
          wrap.style.background = hex;
          wrap.style.color = fg;
          wrap.style.padding = "2px 6px";
          wrap.style.borderRadius = "6px";
          wrap.style.border = `1px solid ${hex}`;
          wrap.style.boxSizing = "border-box";
          wrap.textContent = arg.event.title;

          return { domNodes: [wrap] };
        }}
      />

      {/* Refuerzo global para respetar los colores inline */}
      <style jsx global>{`
        .fc .fc-timegrid-event,
        .fc .fc-timegrid-event .fc-event-main {
          background-color: inherit !important;
          border-color: inherit !important;
          color: inherit !important;
        }
      `}</style>
    </>
  );
}
