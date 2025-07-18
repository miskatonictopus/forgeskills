"use client"

import { useEffect, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import esLocale from "@fullcalendar/core/locales/es"

import "@fullcalendar/core/index.js";
import "@fullcalendar/daygrid/index.js";
import "@fullcalendar/timegrid/index.js";
import "../src/styles/fullcalendar-overrides.css";


declare global {
    interface Window {
      electronAPI: {
        leerHorarios(id: string): unknown
        leerAsignaturas(): unknown
        leerCursos(): unknown
        leerHorariosTodos: () => Promise<
          {
            title: string
            start: string
            end: string
          }[]
        >
      }
    }
  }

type Evento = {
  title: string
  start: Date
  end: Date
}

type EventoBase = {
  title: string
  start: string
  end: string
}

export default function MiCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([])

  useEffect(() => {
    // 👇 Esta función sí es async y se llama correctamente
    const obtenerEventos = async () => {
      try {
        const resultado = await window.electronAPI.leerHorariosTodos() as EventoBase[]
        console.log("📅 Resultado horarios:", resultado)

        const eventosProcesados: Evento[] = []

        for (const h of resultado) {
          console.log("🔍 Analizando horario:", h)

          const startBase = new Date(h.start)
          const endBase = new Date(h.end)
          const nombre = h.title || "Clase sin título"

          // 🔁 Genera 20 repeticiones semanales (luego lo cambiaremos por fechaInicio y fechaFin)
          for (let i = 0; i < 20; i++) {
            const start = new Date(startBase)
            const end = new Date(endBase)

            start.setDate(start.getDate() + i * 7)
            end.setDate(end.getDate() + i * 7)

            eventosProcesados.push({
              title: `📘 ${nombre}`,
              start,
              end,
            })
          }
        }

        console.log("✅ Eventos procesados:", eventosProcesados)
        setEventos(eventosProcesados)
      } catch (error) {
        console.error("❌ Error leyendo horarios:", error)
      }
    }

    obtenerEventos() // ✅ llamada correcta
  }, [])

  return (
    <div className="bg-zinc-950 rounded-xl p-4 shadow-xl text-black">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        locales={[esLocale]}
        locale="es"
        events={eventos}
        editable={false}
        selectable={false}
        height="auto"
        nowIndicator={true}
      />
    </div>
  )
}
