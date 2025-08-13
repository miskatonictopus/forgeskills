"use client";

import { useEffect, useState, useCallback } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import type { FCEvent } from "@/components/calendario/Calendario";
import Calendario, { FCEvent as Evento } from "@/components/calendario/Calendario";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";

// Utils
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function CalendarioGlobalPage() {
  const [events, setEvents] = useState<FCEvent[]>([]);
  const [diasPermitidos, setDiasPermitidos] = useState<number[] | undefined>(undefined);

  const [openDialog, setOpenDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fechaPreseleccionada, setFechaPreseleccionada] = useState<Date | undefined>(undefined);

  // Cargar todas las actividades
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const acts =
          (await window.electronAPI.listarActividadesGlobal?.()) ??
          // Fallback: si aún no tienes el IPC, juntamos por curso
          (await (async () => {
            const cursos = await window.electronAPI.leerCursos();
            const porCurso = await Promise.all(
              cursos.map(async (c) => {
                const arr = await window.electronAPI.actividadesDeCurso(c.id);
                return arr.map((a) => ({ ...a, cursoNombre: c.nombre }));
              })
            );
            return porCurso.flat();
          })());
  
        if (!alive) return;
  
        const evts: Evento[] = (acts || []).map((a: any) => ({
          id: a.id,
          title: `${a.nombre}${a.cursoNombre ? ` · ${a.cursoNombre}` : ""}`,
          start: `${a.fecha}T${a.horaInicio ? a.horaInicio + ":00" : "08:00:00"}`,
          end: a.horaFin ? `${a.fecha}T${a.horaFin}:00` : undefined,
        }));
  
        setEvents(evts);
        setDiasPermitidos(undefined); // global: sin restricción
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar las actividades.");
      }
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  // Crear actividad desde click en calendario
  const handleCreate = useCallback((date: Date) => {
    setFechaPreseleccionada(date);
    setOpenDialog(true);
  }, []);

  // Mover actividad
  const handleMove = useCallback(async ({ id, start }: { id: string; start: Date }) => {
    try {
      const nuevaFecha = ymdLocal(start);
      await window.electronAPI.actualizarActividadFecha(id, nuevaFecha);
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, start: `${nuevaFecha}T08:00:00` } : e))
      );
      toast.success("Actividad reprogramada.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo reprogramar la actividad.");
    }
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/calendario">Calendario</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Contenido */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Calendario global</h1>
            <Button onClick={() => setOpenDialog(true)}>Nueva actividad</Button>
          </div>

          <Calendario
  events={events}
  diasPermitidos={diasPermitidos}
  initialView="timeGridWeek"
  onDateClick={handleCreate}      
  onEventMove={handleMove}        
  slotMinTime="08:00:00"
  slotMaxTime="20:00:00"
  height="auto"
/>

<DialogCrearActividad
  open={openDialog}
  onOpenChange={setOpenDialog}
  setRefreshKey={setRefreshKey}
  fechaInicial={fechaPreseleccionada}
/>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
