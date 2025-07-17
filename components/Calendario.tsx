"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import esLocale from "@fullcalendar/core/locales/es"

export default function MiCalendario() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-xl text-black">
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
        events={[
          {
            title: "📘 Clase de 0612",
            start: "2025-07-18T10:00:00",
            end: "2025-07-18T12:00:00",
          },
          {
            title: "🧪 Examen final",
            start: "2025-07-19T09:00:00",
            end: "2025-07-19T11:00:00",
          },
        ]}
        editable={true}
        selectable={true}
        height="auto"
      />
    </div>
  )
}

