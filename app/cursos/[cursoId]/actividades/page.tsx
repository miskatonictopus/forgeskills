"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { VistaRAyCE } from "@/components/VistaRAyCE";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlusCircle, CalendarDays } from "lucide-react";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { DialogVerActividad } from "@/components/actividades/DialogVerActividad";
import { useSnapshot } from "valtio";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { actividadesPorCurso, cargarActividades } from "@/store/actividadesPorCurso";

type Actividad = {
  id: string;
  nombre: string;
  fecha: string;
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;
};

export default function ActividadesCursoPage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const snapAsignaturas = useSnapshot(asignaturasPorCurso);
  const snapActividades = useSnapshot(actividadesPorCurso);

  const [open, setOpen] = useState(false);
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState<string | null>(null);
  const [verDialogOpen, setVerDialogOpen] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null);

  const asignaturas = snapAsignaturas[cursoId] || [];
  const actividades = snapActividades[cursoId] || [];

  useEffect(() => {
    if (cursoId) {
      cargarActividades(cursoId);
    }
  }, [cursoId]);

  const actividadesAgrupadas: Record<string, Actividad[]> = {};
  actividades.forEach((actividad) => {
    if (!actividadesAgrupadas[actividad.asignaturaId]) {
      actividadesAgrupadas[actividad.asignaturaId] = [];
    }
    actividadesAgrupadas[actividad.asignaturaId].push(actividad);
  });

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/panel">Panel</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/cursos/${cursoId}`}>{cursoId}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>Actividades</BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-2xl font-bold mt-2">Actividades del curso {cursoId}</h1>
          </div>
        </div>

        <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {asignaturas.map((asig) => {
            const actividadesAsignatura = actividadesAgrupadas[asig.id] || [];

            return (
              <div
                key={asig.id}
                className="border border-zinc-800 bg-background rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">{asig.nombre}</h2>
                  <Button
  onClick={() => {
    setAsignaturaSeleccionada(asig.id);
    setOpen(true);
  }}
>
  <PlusCircle className="w-4 h-4 mr-2" />
  Crear actividad
</Button>
                </div>

                {actividadesAsignatura.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
                ) : (
                  <ul className="space-y-2">
                    {actividadesAsignatura.map((actividad) => (
                      <li
                        key={actividad.id}
                        onClick={() => {
                          setActividadSeleccionada(actividad);
                          setVerDialogOpen(true);
                        }}
                        className="cursor-pointer border border-zinc-700 bg-zinc-900 rounded-md px-4 py-2 flex items-center justify-between hover:bg-zinc-800 transition"
                      >
                        <div>
                          <p className="text-white font-medium">{actividad.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(actividad.fecha).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <DialogCrearActividad
          open={open}
          onOpenChange={(estado) => {
            setOpen(estado);
            if (!estado) setAsignaturaSeleccionada(null);
          }}
          cursoId={cursoId}
          asignaturaId={asignaturaSeleccionada ?? undefined}
          setRefreshKey={() => cargarActividades(cursoId)}
        />

        <DialogVerActividad
          open={verDialogOpen}
          onOpenChange={setVerDialogOpen}
          actividad={actividadSeleccionada}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
