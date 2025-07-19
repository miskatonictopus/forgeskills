"use client"

import { useEffect, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import esLocale from "@fullcalendar/core/locales/es"
import "@fullcalendar/core/index.js"
import "@fullcalendar/daygrid/index.js"
import "@fullcalendar/timegrid/index.js"
import "../src/styles/fullcalendar-overrides.css"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StickyNote } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"

type Evento = {
  title: string
  start: Date
  end: Date
  extendedProps: {
    asignaturaId?: string
    color?: string
  }
}

type Asignatura = {
  id: string
  nombre: string
  color?: string
}

declare global {
  interface Window {
    electronAPI: {
      leerHorarios(id: string): unknown
      leerAsignaturas(): Promise<Asignatura[]>
      leerCursos(): unknown
      leerHorariosTodos: () => Promise<
        {
          title: string
          start: string
          end: string
          asignaturaId?: string
        }[]
      >
    }
  }
}

export default function MiCalendario() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [eventoActivo, setEventoActivo] = useState<{
    clave: string
    titulo: string
    hora: string
  } | null>(null)

  const calendarRef = useRef<FullCalendar | null>(null)
  const [vista, setVista] = useState<
    "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  >("timeGridWeek")

  const cambiarVista = (
    nuevaVista: "dayGridMonth" | "timeGridWeek" | "timeGridDay"
  ) => {
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.changeView(nuevaVista)
      setVista(nuevaVista)
    }
  }

  useEffect(() => {
    const obtenerEventos = async () => {
      try {
        const resultado = await window.electronAPI.leerHorariosTodos()
        const asignaturas = await window.electronAPI.leerAsignaturas()

        const eventosProcesados: Evento[] = []

        for (const h of resultado) {
          const asignatura = asignaturas.find((a) => a.id === h.asignaturaId)
          const color = asignatura?.color || "#666"
          const nombre = asignatura?.nombre || h.title || "Clase"

          const startBase = new Date(h.start)
          const endBase = new Date(h.end)

          for (let i = 0; i < 20; i++) {
            const start = new Date(startBase)
            const end = new Date(endBase)
            start.setDate(start.getDate() + i * 7)
            end.setDate(end.getDate() + i * 7)

            eventosProcesados.push({
              title: nombre,
              start,
              end,
              extendedProps: {
                asignaturaId: h.asignaturaId || "",
                color,
              },
            })
          }
        }

        setEventos(eventosProcesados)
      } catch (error) {
        console.error("❌ Error leyendo horarios:", error)
      }
    }

    obtenerEventos()
  }, [])

  return (
    <div className="bg-zinc-950 rounded-xl p-4 shadow-xl text-black">
      <div className="flex justify-end mb-4 gap-2">
        <Button
          variant={vista === "timeGridDay" ? "default" : "secondary"}
          onClick={() => cambiarVista("timeGridDay")}
        >
          <span className="font-light uppercase">Día</span>
        </Button>
        <Button
          variant={vista === "timeGridWeek" ? "default" : "secondary"}
          onClick={() => cambiarVista("timeGridWeek")}
        >
          <span className="font-light uppercase">Semana</span>
        </Button>
        <Button
          variant={vista === "dayGridMonth" ? "default" : "secondary"}
          onClick={() => cambiarVista("dayGridMonth")}
        >
          <span className="font-light uppercase">Mes</span>
        </Button>
      </div>
  
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={vista}
        headerToolbar={false}
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
        locales={[esLocale]}
        locale="es"
        events={eventos}
        editable={false}
        selectable={false}
        height="auto"
        nowIndicator={true}
        allDaySlot={false}
        hiddenDays={[0, 6]}
        eventClick={(info) => {
          const id = info.event.extendedProps?.asignaturaId || "";
          const fecha = info.event.start?.toISOString().split("T")[0] ?? "sin-fecha";
          const hora = info.event.start?.toISOString().split("T")[1]?.slice(0, 5) ?? "00:00";
          const clave = `${id}_${fecha}_${hora}`;
  
          setEventoActivo({
            clave,
            titulo: info.event.title,
            hora: info.event.start?.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            }) ?? "",
          });
        }}
        eventContent={(arg) => {
          const id = arg.event.extendedProps?.asignaturaId || "";
          const bgColor = arg.event.extendedProps?.color || "#666";
          const fecha = arg.event.start?.toISOString().split("T")[0] ?? "sin-fecha";
          const hora = arg.event.start?.toISOString().split("T")[1]?.slice(0, 5) ?? "00:00";
          const clave = `${id}_${fecha}_${hora}`;
          const hayNota = !!notas[clave];
  
          return (
            <div
              className="flex flex-col w-full h-full px-2 py-1 text-sm font-medium text-white rounded relative"
              style={{ backgroundColor: bgColor }}
            >
              <div className="truncate">
                <span className="font-bold">{arg.timeText}</span> –{" "}
                <span className="uppercase font-light text-xs">{arg.event.title}</span>
              </div>
  
              {/* Icono nota con Tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute top-1 right-1 cursor-pointer ${
                        hayNota ? "text-white" : "text-white/70"
                      } hover:text-white`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEventoActivo({
                          clave,
                          titulo: arg.event.title,
                          hora: arg.timeText,
                        });
                      }}
                    >
                      <StickyNote size={26} className="stroke-[1.5]" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{hayNota ? "Editar nota" : "Añadir nota"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        }}
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
  
      {/* 🎯 MODAL DE NOTAS */}
      {eventoActivo && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {eventoActivo.titulo}
                </h2>
                <p className="text-sm text-zinc-400">{eventoActivo.hora}</p>
              </div>
              <button
                onClick={() => setEventoActivo(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
  
            <Textarea
              placeholder="Escribe tus notas..."
              value={notas[eventoActivo.clave] || ""}
              onChange={(e) =>
                setNotas((prev) => ({
                  ...prev,
                  [eventoActivo.clave]: e.target.value,
                }))
              }
              className="resize-none h-40 bg-zinc-800 text-white placeholder:text-zinc-500 text-sm"
            />
  
            <div className="mt-4 text-right">
              <button
                onClick={() => setEventoActivo(null)}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-md text-sm"
              >
                Guardar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
            }