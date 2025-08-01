"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays } from "lucide-react";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { useSnapshot } from "valtio";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

type Actividad = {
  id: string;
  nombre: string;
  fecha: string;
  cursoId: string;
  asignaturaId: string;
};

export default function ActividadesCursoPage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const snap = useSnapshot(asignaturasPorCurso);
  const asignaturas = snap[cursoId] || [];

  useEffect(() => {
    if (!cursoId) return;
    window.electronAPI.actividadesDeCurso(cursoId).then(setActividades);
  }, [cursoId, refreshKey]);

  // Agrupar actividades por asignaturaId
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

          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Actividad
          </Button>
        </div>

        <div className="px-4 pb-8 space-y-6">
          {asignaturas.map((asig) => {
            const actividadesAsignatura = actividadesAgrupadas[asig.id] || [];

            return (
              <div key={asig.id}>
                <h2 className="text-lg font-semibold text-white mb-2">
                  {asig.nombre}
                </h2>
                {actividadesAsignatura.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
                ) : (
                  <ul className="space-y-2">
                    {actividadesAsignatura.map((actividad) => (
                      <li
                        key={actividad.id}
                        className="border border-zinc-700 bg-zinc-900 rounded-md px-4 py-2 flex items-center justify-between"
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
  onOpenChange={setOpen}
  cursoId={cursoId}
  setRefreshKey={setRefreshKey}
/>
      </SidebarInset>
    </SidebarProvider>
  );
}
