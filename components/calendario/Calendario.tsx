"use client";

import React from "react";
import dynamic from "next/dynamic";
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });

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

  // ⭐ nueva prop: te dejo decidir el título final con acceso a tu store
  resolveTitle?: (e: FCEvent) => string;

  // ✅ props nativas para controlar solapes/orden
  eventOverlap?: boolean | ((stillEvent: any, movingEvent: any) => boolean);
  eventOrder?: string | ((a: any, b: any) => number);
  slotEventOverlap?: boolean;
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
const fromMinHHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
};
const withAutoDuration = (e: FCEvent): FCEvent => {
  const ep = e.extendedProps || {};
  const hasRecurrence = !!(e.daysOfWeek || e.rrule || e.startRecur);

  if (hasRecurrence && e.startTime && !e.endTime && !e.duration) {
    const fin = (ep.horaFin as string) || (ep.endTime as string) || "";
    const durMin =
      ep.duracionMin ?? ep.duracionMinutos ?? ep.durationMin ?? ep.minutes ?? ep.mins ?? null;

    if (fin) {
      return { ...e, endTime: /^\d{1,2}:\d{2}$/.test(fin) ? `${fin}:00` : fin };
    } else if (durMin != null) {
      const minutes = typeof durMin === "number" ? durMin : parseInt(String(durMin), 10);
      if (Number.isFinite(minutes)) {
        return { ...e, duration: fromMinHHMM(minutes) };
      }
    }
  }

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
  resolveTitle, // ⭐

  // ✅ nuevas props (opcionales)
  eventOverlap,
  eventOrder,
  slotEventOverlap,
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

  // 1) normalizamos eventos (duraciones, allDay, etc.)
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

  // 2) forzamos título con resolver externo si existe
  const displayEvents = React.useMemo<FCEvent[]>(() => {
    if (!resolveTitle) return sanitizedEvents;
    return sanitizedEvents.map((e) => {
      try {
        const t = resolveTitle(e);
        return t && t !== e.title ? { ...e, title: t } : e;
      } catch {
        return e;
      }
    });
  }, [sanitizedEvents, resolveTitle]);

  return (
    <>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        events={displayEvents as any}
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

        /* ✅ nuevas opciones pasadas tal cual a FullCalendar */
        eventOverlap={eventOverlap}
        eventOrder={eventOrder}
        slotEventOverlap={slotEventOverlap}

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

          const main = el.querySelector(".fc-event-main") as HTMLElement | null;
          if (main) {
            main.style.backgroundColor = hex;
            main.style.color = fg;
            main.style.borderColor = hex;
            main.style.height = "100%";
            main.style.borderRadius = "8px";
            main.style.boxSizing = "border-box";
          }

          el.style.setProperty("--fc-event-bg-color", hex);
          el.style.setProperty("--fc-event-border-color", hex);
          el.style.setProperty("--fc-event-text-color", fg);
        }}
        eventContent={(arg: any) => {
          // No personalizamos los background events
          if (arg.event.display === "background") return undefined;

          const ep = (arg.event.extendedProps ?? {}) as any;
          const raw =
            ep.__color ||
            ep.color ||
            (typeof arg.event.backgroundColor === "string" ? arg.event.backgroundColor : "") ||
            "";
          const hex = normalizeHex(raw);
          const fg = hex ? textOn(hex) : undefined;

          // Partimos el title que viene como: "Asignatura · CURSO_TAG"
          const title = String(arg.event.title || "");
          const parts = title.split(" · ");
          const asignatura = parts.length > 1 ? parts[0] : title;
          const cursoTag = parts.length > 1 ? parts.slice(1).join(" · ") : "";

          // Contenedor
          const wrap = document.createElement("div");
          wrap.style.height = "100%";
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "flex-start";
          wrap.style.justifyContent = "flex-start";
          wrap.style.gap = "4px";
          wrap.style.padding = "4px 6px";
          wrap.style.borderRadius = "8px";
          wrap.style.boxSizing = "border-box";
          if (hex) {
            wrap.style.background = hex;
            wrap.style.border = `1px solid ${hex}`;
            wrap.style.color = fg!;
          }

          // Curso (arriba izq., más grande y negrita)
          const top = document.createElement("div");
          top.textContent = cursoTag || "";
          top.style.fontWeight = "700";
          top.style.fontSize = "18px";
          top.style.lineHeight = "1.1";
          top.style.textAlign = "left";
          top.style.width = "100%";
          top.style.whiteSpace = "nowrap";
          top.style.overflow = "hidden";
          top.style.textOverflow = "ellipsis";

          // Asignatura (debajo, más pequeña)
          const bottom = document.createElement("div");
          bottom.textContent = asignatura;
          bottom.style.fontSize = "13px";
          bottom.style.lineHeight = "1.1";
          bottom.style.textAlign = "left";
          bottom.style.opacity = "0.95";
          bottom.style.width = "100%";
          bottom.style.whiteSpace = "nowrap";
          bottom.style.overflow = "hidden";
          bottom.style.textOverflow = "ellipsis";

          // Si por lo que sea no hay cursoTag, mostramos solo el título
          wrap.appendChild(top.textContent ? top : bottom);
          if (top.textContent) wrap.appendChild(bottom);

          return { domNodes: [wrap] };
        }}
      />

      <style jsx global>{`
        /* Sin sombras ni filtros en TODO lo que vaya dentro de un evento */
        .fc .fc-event,
        .fc .fc-event * {
          text-shadow: none !important;
          -webkit-text-stroke: 0 !important;
          filter: none !important;
        }

        /* Por si tu tema añade estilos más específicos */
        .fc .fc-timegrid-event .fc-event-main,
        .fc .fc-daygrid-event .fc-event-main,
        .fc .fc-event-title,
        .fc .fc-event-time,
        .fc .fc-event-main-frame {
          text-shadow: none !important;
          filter: none !important;
        }

        .fc .fct-bg {
          background: #a3a3a3 !important;
          opacity: 1 !important;
          margin: 4px !important;
          border-radius: 10px !important;
        }

        .fc .fct-bg::after {
          content: "FCT";
          position: absolute;
          top: 3px;
          left: 5px;
          font-size: 13px;
          font-weight: 400;
          color: #111;
        }

        /* (lo que ya tenías) */
        .fc .fc-event,
        .fc .fc-timegrid-event,
        .fc .fc-timegrid-event .fc-event-main,
        .fc .fc-daygrid-event,
        .fc .fc-daygrid-event .fc-event-main {
          border: none !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        .fc .presencial-bg {
          background: #e5e5e5 !important;
          opacity: 1 !important;
          border: none !important;
          border-radius: 10px !important;
        }
        .fc .presencial-bg .fc-event-main {
          color: #111 !important;
        }
        .fc .presencial-bg::after {
          content: "PRESENCIALIDAD";
          position: absolute;
          top: 3px;
          left: 5px;
          font-size: 13px;
          font-weight: 400;
          color: #111;
        }
        .fc .presencial-bg { margin: 4px !important; }
        .fc .fc-timegrid-slot { height: 3em !important; }
      `}</style>
    </>
  );
}
