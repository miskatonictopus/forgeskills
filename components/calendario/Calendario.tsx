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
  daysOfWeek?: number[];       // p.ej. [1] (lunes)
  startTime?: string;          // "09:00:00"
  endTime?: string;            // "11:00:00"  ← si falta, lo inferimos
  startRecur?: string;         // "YYYY-MM-DD"
  endRecur?: string;           // "YYYY-MM-DD"
  classNames?: string[];
  editable?: boolean;
  display?: "auto" | "block" | "list-item" | "background" | "inverse-background" | "none";
  backgroundColor?: string;    // usamos esto para colores
  borderColor?: string;
  textColor?: string;
  rrule?: any;
  duration?: string;           // "02:00"      ← alternativa a endTime
  extendedProps?: Record<string, any>; // puede traer horaFin, duracionMin, __color, etc.
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

/* === Helpers de tiempo para inferir endTime/duration === */
const toMin = (hhmm?: string) => {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h * 60 + min;
};
const fromMinHHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
};

/**
 * Rellena automáticamente endTime o duration si falta:
 * - Si hay startTime y extendedProps.horaFin -> endTime = horaFin
 * - Si hay startTime y extendedProps.duracionMin(utos) -> duration = "HH:MM"
 * - Si hay start con hora "YYYY-MM-DDTHH:mm" y extendedProps.horaFin -> end = misma fecha con horaFin
 * - Si hay start con hora y extendedProps.duracionMin -> end = start + duración
 */
const withAutoDuration = (e: FCEvent): FCEvent => {
  const ep = e.extendedProps || {};
  const hasRecurrence = !!(e.daysOfWeek || e.rrule || e.startRecur);

  // Caso A: recurrente con startTime (clases semanales)
  if (hasRecurrence && e.startTime && !e.endTime && !e.duration) {
    const fin = (ep.horaFin as string) || (ep.endTime as string) || "";
    const durMin =
      ep.duracionMin ?? ep.duracionMinutos ?? ep.durationMin ?? ep.minutes ?? ep.mins ?? null;

    if (fin) {
      return { ...e, endTime: /^\d{1,2}:\d{2}$/.test(fin) ? `${fin}:00` : fin };
    } else if (durMin != null) {
      const minutes = typeof durMin === "number" ? durMin : parseInt(String(durMin), 10);
      if (Number.isFinite(minutes)) {
        return { ...e, duration: fromMinHHMM(minutes) }; // p.ej. "02:00"
      }
    }
  }

  // Caso B: puntual con start (ISO) sin end
  if (!hasRecurrence && typeof e.start === "string" && !e.end) {
    const hasTime = /\d{2}:\d{2}/.test(e.start);
    if (hasTime) {
      const fin = (ep.horaFin as string) || (ep.endTime as string) || "";
      if (fin) {
        const date = e.start.slice(0, 10);
        const finNorm = /^\d{1,2}:\d{2}$/.test(fin) ? `${fin}:00` : fin;
        return { ...e, end: `${date}T${finNorm}` };
      }
      const durMin =
        ep.duracionMin ?? ep.duracionMinutos ?? ep.durationMin ?? ep.minutes ?? ep.mins ?? null;
      const minutes = typeof durMin === "number" ? durMin : parseInt(String(durMin || ""), 10);
      if (Number.isFinite(minutes)) {
        const start = new Date(e.start);
        const end = new Date(start.getTime() + minutes * 60 * 1000).toISOString();
        return { ...e, end };
      }
    }
  }

  return e;
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

  // 1) Asegura duración/fin
  // 2) No convierte a allDay los recurrentes con horas
  const sanitizedEvents = React.useMemo<FCEvent[]>(() => {
    return (events ?? []).map((ev) => {
      let e = withAutoDuration(ev);

      const isRecurrentTimed =
        !!(e.daysOfWeek || e.rrule || e.startRecur) && (e.startTime || e.endTime || e.duration);

      if (!isRecurrentTimed) {
        if (typeof e.start === "string") {
          if (isDateOnly(e.start) || isMidnight(e.start)) e = { ...e, allDay: true };
        } else if (isMidnight(e.start)) {
          e = { ...e, allDay: true };
        }
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
        slotDuration="00:30:00"
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

        /* ✅ Mantiene tu forma de pintar colores */
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
        
          try {
            info.event.setProp("backgroundColor", hex);
            info.event.setProp("borderColor", hex);
            info.event.setProp("textColor", fg);
          } catch {}
        
          // Pintamos también el elemento MAIN del evento (el que FC usa para el fondo)
          const main = el.querySelector(".fc-event-main") as HTMLElement | null;
          if (main) {
            main.style.backgroundColor = hex;
            main.style.color = fg;
            main.style.borderColor = hex;
            main.style.height = "100%";
            main.style.borderRadius = "8px";
            main.style.boxSizing = "border-box";
          }
        
          // Variables CSS por si el tema las usa
          el.style.setProperty("--fc-event-bg-color", hex);
          el.style.setProperty("--fc-event-border-color", hex);
          el.style.setProperty("--fc-event-text-color", fg);
        }}
        

        /* 🛟 Fallback por si algún tema pisa estilos */
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
          wrap.style.height = "100%";           // 👈 clave
          wrap.style.display = "flex";          // verticalmente centrado
          wrap.style.alignItems = "center";
          wrap.style.background = hex;
          wrap.style.color = fg;
          wrap.style.padding = "2px 6px";
          wrap.style.borderRadius = "8px";
          wrap.style.border = `1px solid ${hex}`;
          wrap.style.boxSizing = "border-box";
          wrap.textContent = arg.event.title;
        
          return { domNodes: [wrap] };
        }}
        
      />

      {/* Quita bordes por defecto y aumenta altura de slot */}
      <style jsx global>{`
  .fc .fc-event,
  .fc .fc-timegrid-event,
  .fc .fc-timegrid-event .fc-event-main,
  .fc .fc-daygrid-event,
  .fc .fc-daygrid-event .fc-event-main {
    border: none !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
  .fc .fc-timegrid-slot {
    height: 3em !important; /* ajusta si quieres más alto */
  }
`}</style>

    </>
  );
}
