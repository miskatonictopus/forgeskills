"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
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
import {
  actividadesPorCurso,
  cargarActividades,
} from "@/store/actividadesPorCurso";
import { Separator } from "@/components/ui/separator";

// 👇 añade los componentes de tabla de shadcn
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

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

  const nombreAsigSel =
  actividadSeleccionada
    ? (asignaturas.find(a => a.id === actividadSeleccionada.asignaturaId)?.nombre
        ?? actividadSeleccionada.asignaturaId)
    : undefined;
    
  useEffect(() => {
    if (cursoId) cargarActividades(cursoId);
  }, [cursoId]);

  // Agrupar por asignatura
  const actividadesAgrupadas: Record<string, Actividad[]> = {};
  actividades.forEach((actividad) => {
    (actividadesAgrupadas[actividad.asignaturaId] ||= []).push(actividad);
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

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
            <h1 className="text-3xl font-bold mt-2">Actividades del curso {cursoId}</h1>
          </div>
        </div>

        <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {asignaturas.map((asig) => {
            const actividadesAsignatura = actividadesAgrupadas[asig.id] || [];

            return (
              <div key={asig.id} className="border border-zinc-800 bg-background rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-2xl font-semibold text-white">{asig.nombre}</h2>
                  <Button
                    size="sm"
                    className="px-2.5 py-2 mt-1 rounded-md bg-white text-black text-xs hover:bg-gray-100"
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
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-zinc-900/60 text-xs">
                        <TableRow>
                          <TableHead className="w-[55%]">Actividad</TableHead>
                          <TableHead className="w-[25%]">Fecha</TableHead>
                          <TableHead className="w-[20%] text-right">Abrir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actividadesAsignatura.map((actividad) => (
                          <TableRow
                            key={actividad.id}
                            className="cursor-pointer hover:bg-zinc-900"
                            onClick={() => {
                              setActividadSeleccionada(actividad);
                              setVerDialogOpen(true);
                            }}
                          >
                            <TableCell className="font-medium truncate">
                              <div className="max-w-[28ch] truncate">{actividad.nombre}</div>
                              {actividad.descripcion && (
                                <div className="text-xs text-muted-foreground max-w-[50ch] truncate">
                                  {actividad.descripcion}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{fmt(actividad.fecha)}</TableCell>
                            <TableCell className="text-right">
                              <CalendarDays className="w-4 h-4 inline-block text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
          // si tu DialogCrearActividad admite setRefreshKey como callback, llama a cargarActividades:
          setRefreshKey={() => cargarActividades(cursoId)}
        />

        <DialogVerActividad
          open={verDialogOpen}
          onOpenChange={setVerDialogOpen}
          actividad={actividadSeleccionada}
          asignaturaNombre={nombreAsigSel}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
