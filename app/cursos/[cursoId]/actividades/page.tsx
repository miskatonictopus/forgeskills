"use client";

import { useEffect, useMemo, useState } from "react";
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
import { PlusCircle, Trash2 } from "lucide-react";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { DialogVerActividad } from "@/components/actividades/DialogVerActividad";
import { useSnapshot } from "valtio";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import {
  actividadesPorCurso,
  cargarActividades,
  estadoUI,            // 👈 importar helper
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
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

// Tipo actividad (añadimos campos que usamos abajo)
type Actividad = {
  id: string;
  nombre: string;
  fecha: string;
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;
  estado?: "borrador" | "analizada" | "programada" | "pendiente_evaluar" | "evaluada" | "cerrada";
  analisisFecha?: string | null;
  umbralAplicado?: number | null;

  // del store normalizado
  estadoCanon?: "borrador" | "analizada" | "programada" | "pendiente_evaluar" | "evaluada" | "cerrada";
  programadaPara?: string | null; // lo usa el badge cuando ev === "programada"
};

function EstadoBadge({
  estadoCanon,
  programadaPara,
  analisisFecha,
}: {
  estadoCanon: Actividad["estadoCanon"];
  programadaPara?: string | null;
  analisisFecha?: string | null;
}) {
  const ev = estadoCanon ?? "borrador";

  const label =
    ev === "analizada" ? "Analizada" :
    ev === "programada" ? "Programada" :
    ev === "pendiente_evaluar" ? "Pendiente de evaluar" :
    ev === "evaluada" ? "Evaluada" :
    ev === "cerrada" ? "Cerrada" :
    "Borrador";

  const cls =
    ev === "analizada" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    ev === "programada" ? "bg-sky-500/15 text-sky-400 border-sky-500/30" :
    ev === "pendiente_evaluar" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    ev === "evaluada" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" :
    ev === "cerrada" ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30" :
    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  // Fechita auxiliar: para analizada mostramos analisisFecha; para programada mostramos programadaPara
  const fechaAux = ev === "analizada" ? analisisFecha : ev === "programada" ? programadaPara : null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn("border", cls)}>
        {label}
      </Badge>
      {fechaAux && (
        <span className="text-[11px] text-muted-foreground">
          {new Date(fechaAux).toLocaleDateString("es-ES")}
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

  // estado para borrar
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actividadABorrar, setActividadABorrar] = useState<Actividad | null>(null);
  const [deleting, setDeleting] = useState(false);

  const asignaturas = snapAsignaturas[cursoId] || [];
  const actividades = snapActividades[cursoId] || [];

  const nombreAsigSel = actividadSeleccionada
    ? asignaturas.find((a) => a.id === actividadSeleccionada.asignaturaId)?.nombre ??
      actividadSeleccionada.asignaturaId
    : undefined;

  useEffect(() => {
    if (cursoId) cargarActividades(cursoId);
  }, [cursoId]);

  // Agrupar por asignatura
  const actividadesAgrupadas: Record<string, Actividad[]> = useMemo(() => {
    const acc: Record<string, Actividad[]> = {};
    actividades.forEach((act) => {
      (acc[act.asignaturaId] ||= []).push(act as any);
    });
    return acc;
  }, [actividades]);

  // Solo se puede borrar si está en borrador o analizada (misma lógica que tenías)
  const puedeBorrar = (estado?: Actividad["estado"]) =>
    estado === "borrador" || estado === "analizada";

  const handleClickBorrar = (e: React.MouseEvent, act: Actividad) => {
    e.stopPropagation();
    if (!puedeBorrar(act.estado)) return;
    setActividadABorrar(act);
    setConfirmOpen(true);
  };

  const borrarActividad = async () => {
    if (!actividadABorrar || !cursoId) return;
    try {
      setDeleting(true);
      if (!("electronAPI" in window) || !window.electronAPI?.borrarActividad) {
        throw new Error("IPC borrarActividad no disponible");
      }
      await window.electronAPI.borrarActividad(actividadABorrar.id);
      toast.success("Actividad eliminada.");
      await cargarActividades(cursoId);
    } catch (err: any) {
      console.error(err);
      toast.error("No se pudo eliminar la actividad.");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setActividadABorrar(null);
    }
  };

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

        <TooltipProvider delayDuration={200}>
          <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {asignaturas.map((asig) => {
              const actividadesAsignatura = (actividadesAgrupadas[asig.id] || [])
                .slice()
                .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));

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
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pr-2">Actividad</TableHead>
                            <TableHead className="w-[190px] whitespace-nowrap">Estado</TableHead>
                            <TableHead className="w-[110px] whitespace-nowrap">Fecha</TableHead>
                            <TableHead className="w-[44px] text-right pr-2"></TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {actividadesAsignatura.map((a) => {
                            // 👇 estado canónico desde store
                            const ev = (a.estado as any) ?? a.estadoCanon ?? estadoUI(a as any);
                            const permitido = puedeBorrar(a.estado); // tu regla original

                            return (
                              <TableRow
                                key={a.id}
                                className="cursor-pointer"
                                onClick={() => {
                                  setActividadSeleccionada(a);
                                  setVerDialogOpen(true);
                                }}
                              >
                                <TableCell className="max-w-0 pr-2 align-top">
                                  <div className="font-semibold truncate" title={a.nombre}>
                                    {a.nombre}
                                  </div>
                                  {a.descripcion ? (
                                    <div
                                      className="text-xs text-muted-foreground truncate"
                                      title={a.descripcion}
                                    >
                                      {a.descripcion}
                                    </div>
                                  ) : null}
                                </TableCell>

                                {/* ESTADO: usamos ev y pasamos programadaPara/analisisFecha */}
                                <TableCell className="w-[190px] whitespace-nowrap align-top">
                                  <EstadoBadge
                                    estadoCanon={ev}
                                    programadaPara={a.programadaPara}
                                    analisisFecha={a.analisisFecha}
                                  />
                                </TableCell>

                                <TableCell className="w-[110px] whitespace-nowrap tabular-nums align-top">
                                  {new Date(a.fecha).toLocaleDateString("es-ES")}
                                </TableCell>

                                <TableCell className="w-[44px] pr-2 align-top">
                                  <div className="flex justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-8 w-8 shrink-0",
                                        permitido
                                          ? "text-white hover:text-red-600 hover:bg-red-500/10"
                                          : "text-muted-foreground opacity-50 cursor-not-allowed"
                                      )}
                                      onClick={(e) => handleClickBorrar(e, a)}
                                      disabled={!permitido}
                                      aria-label={
                                        permitido
                                          ? "Eliminar actividad"
                                          : "No se puede eliminar en este estado"
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

        <DialogCrearActividad
          open={open}
          onOpenChange={(estado) => {
            setOpen(estado);
            if (!estado) setAsignaturaSeleccionada(null);
          }}
          cursoId={cursoId}
          asignaturaId={asignaturaSeleccionada ?? undefined}
          setRefreshKey={() => cargarActividades(cursoId)} // 👈 refresca tras crear
        />

        <DialogVerActividad
          open={verDialogOpen}
          onOpenChange={setVerDialogOpen}
          actividad={actividadSeleccionada as any}
          asignaturaNombre={
            actividadSeleccionada
              ? (snapAsignaturas[cursoId] || []).find(a => a.id === actividadSeleccionada.asignaturaId)?.nombre
              : undefined
          }
        />

        {/* Confirmación de borrado */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar actividad</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a eliminar{" "}
                <span className="font-medium">{actividadABorrar?.nombre}</span>.
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={borrarActividad}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
