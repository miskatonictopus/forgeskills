"use client";

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import "@fullcalendar/core/index.js";
import "@fullcalendar/daygrid/index.js";
import "@fullcalendar/timegrid/index.js";
import "../src/styles/fullcalendar-overrides.css";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    electronAPI: {
      leerHorarios(id: string): unknown;
      leerAsignaturas(): unknown;
      leerCursos(): unknown;
      leerHorariosTodos: () => Promise<
        {
          title: string;
          start: string;
          end: string;
        }[]
      >;
    };
  }
}

type Evento = {
  title: string;
  start: Date;
  end: Date;
};

type EventoBase = {
  title: string;
  start: string;
  end: string;
};

export default function MiCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const calendarRef = useRef<FullCalendar | null>(null);
  const [vista, setVista] = useState<
    "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  >("timeGridWeek");

  const cambiarVista = (
    nuevaVista: "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  ) => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(nuevaVista);
      setVista(nuevaVista);
    }
  };

  useEffect(() => {
    const obtenerEventos = async () => {
      try {
        const resultado =
          (await window.electronAPI.leerHorariosTodos()) as EventoBase[];
        const eventosProcesados: Evento[] = [];

        for (const h of resultado) {
          const startBase = new Date(h.start);
          const endBase = new Date(h.end);
          const nombre = h.title || "Clase sin título";

          for (let i = 0; i < 20; i++) {
            const start = new Date(startBase);
            const end = new Date(endBase);
            start.setDate(start.getDate() + i * 7);
            end.setDate(end.getDate() + i * 7);

            eventosProcesados.push({
              title: `📘 ${nombre}`,
              start,
              end,
            });
          }
        }

        setEventos(eventosProcesados);
      } catch (error) {
        console.error("❌ Error leyendo horarios:", error);
      }
    };

    obtenerEventos();
  }, []);

  return (
    <div className="bg-zinc-950 rounded-xl p-4 shadow-xl text-black">
      <div className="flex justify-end mb-4 gap-2">
        <Button
          variant={vista === "timeGridDay" ? "default" : "secondary"}
          onClick={() => cambiarVista("timeGridDay")}
        >
          Día
        </Button>

        <Button
          variant={vista === "timeGridWeek" ? "default" : "secondary"}
          onClick={() => cambiarVista("timeGridWeek")}
        >
          Semana
        </Button>

        <Button
          variant={vista === "dayGridMonth" ? "default" : "secondary"}
          onClick={() => cambiarVista("dayGridMonth")}
        >
          Mes
        </Button>
      </div>

      <FullCalendar
  ref={calendarRef}
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView={vista}
  headerToolbar={false}
  locales={[esLocale]}
  locale="es"
  events={eventos}
  editable={false}
  selectable={false}
  height="auto"
  nowIndicator={true}
  views={{
    timeGridWeek: {
      slotLabelFormat: [
        { hour: "2-digit", minute: "2-digit", hour12: false },
      ],
      dayHeaderFormat: {
        weekday: "long",
        day: "numeric",
        month: "long",
      },
    },
    timeGridDay: {
      dayHeaderFormat: {
        weekday: "long",
        day: "numeric",
        month: "long",
      },
    },
  }}
/>
    </div>
  );
}
