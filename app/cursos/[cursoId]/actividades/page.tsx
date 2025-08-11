"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { DialogVerActividad } from "@/components/actividades/DialogVerActividad";
import { useSnapshot } from "valtio";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import {
  actividadesPorCurso,
  cargarActividades,
} from "@/store/actividadesPorCurso";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

// Extiende el tipo para incluir estado/fecha/umbral si tu store aún no lo tiene
type Actividad = {
  id: string;
  nombre: string;
  fecha: string;
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;
  estado?: "borrador" | "analizada" | "enviada" | "pendiente" | "evaluada";
  analisisFecha?: string | null;
  umbralAplicado?: number | null;
};

function EstadoBadge({
  estado,
  fecha,
}: {
  estado?: string;
  fecha?: string | null;
}) {
  const label =
    estado === "analizada"
      ? "Analizada"
      : estado === "enviada"
      ? "Enviada"
      : estado === "pendiente"
      ? "Pendiente"
      : estado === "evaluada"
      ? "Evaluada"
      : "Borrador";

  const cls =
    estado === "analizada"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : estado === "enviada"
      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
      : estado === "pendiente"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : estado === "evaluada"
      ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
      : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn("border", cls)}>{label}</Badge>
      {estado === "analizada" && fecha && (
        <span className="text-[11px] text-muted-foreground">
          {new Date(fecha).toLocaleDateString("es-ES")}
        </span>
      )}
    </div>
  );
}

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
      ? (asignaturas.find((a) => a.id === actividadSeleccionada.asignaturaId)?.nombre ??
         actividadSeleccionada.asignaturaId)
      : undefined;

  useEffect(() => {
    if (cursoId) cargarActividades(cursoId);
  }, [cursoId]);

  // Agrupar por asignatura para render
  const actividadesAgrupadas: Record<string, Actividad[]> = {};
  actividades.forEach((act) => {
    (actividadesAgrupadas[act.asignaturaId] ||= []).push(act);
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
            <h1 className="text-3xl font-bold mt-2">Actividades del curso {cursoId}</h1>
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
                <div className="flex items-center justify-between mb-3 h-[75px]">
                  <h2 className="text-2xl font-semibold text-white">
                    <span className="text-zinc-400">{asig.id}</span> {asig.nombre}
                  </h2>
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

                <Separator className="my-4" />

                {actividadesAsignatura.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
                ) : (
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <Table className="table-fixed">
  <colgroup>
    <col className="w-[60%]" />   
    <col className="w-[20%]" />   
    <col className="w-[20%]" />   
  </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Actividad</TableHead>
                          <TableHead className="w-[160px]">Estado</TableHead>
                          <TableHead className="w-[120px]">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {actividadesAsignatura.map((a) => (
                          <TableRow
                            key={a.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setActividadSeleccionada(a);
                              setVerDialogOpen(true);
                            }}
                          >
                            <TableCell>
  <div className="font-semibold truncate" title={a.nombre}>{a.nombre}</div>
  {a.descripcion ? (
    <div className="text-xs text-muted-foreground truncate" title={a.descripcion}>
      {a.descripcion}
    </div>
  ) : null}
</TableCell>

                            <TableCell>
                              <EstadoBadge estado={a.estado}/>
                            </TableCell>

                            <TableCell className="tabular-nums">
                              {new Date(a.fecha).toLocaleDateString("es-ES")}
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
