"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSnapshot } from "valtio";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { DialogVerActividad } from "@/components/actividades/DialogVerActividad";

// 🗂️ stores
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import type { Actividad as ActividadT, EstadoUI } from "@/store/actividadesPorCurso";
import { actividadesPorCurso, cargarActividades, estadoUI } from "@/store/actividadesPorCurso";

// ====== Tipos ======
type Curso = { id: string; acronimo?: string; nombre?: string };

// ====== UI: EstadoBadge ======
function EstadoBadge({
  estadoCanon,
  programadaPara,
  analisisFecha,
  evaluadaFecha,
}: {
  estadoCanon?: EstadoUI;
  programadaPara?: string | null;
  analisisFecha?: string | null;
  evaluadaFecha?: string | null;
}) {
  const ev = estadoCanon ?? "borrador";

  const label =
    ev === "analizada" ? "Analizada" :
    ev === "programada" ? "Programada" :
    ev === "pendiente_evaluar" ? "Pendiente de evaluar" :
    ev === "evaluada" ? "Evaluada" :
    ev === "cerrada" ? "Cerrada" : "Borrador";

  const cls =
    ev === "analizada" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    ev === "programada" ? "bg-sky-500/15 text-sky-400 border-sky-500/30" :
    ev === "pendiente_evaluar" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    ev === "evaluada" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" :
    ev === "cerrada" ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30" :
    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  const fechaAux =
    ev === "analizada"  ? analisisFecha  :
    ev === "programada" ? programadaPara :
    ev === "evaluada"   ? evaluadaFecha  :
    null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn("border", cls)}>{label}</Badge>
      {fechaAux && (
        <span className="text-[11px] text-muted-foreground">
          {new Date(fechaAux).toLocaleDateString("es-ES")}
        </span>
      )}
    </div>
  );
}

export default function ActividadesTodosLosCursosPage() {
  const snapCursos = useSnapshot(cursoStore);
  const snapAsignaturas = useSnapshot(asignaturasPorCurso);
  const snapActividades = useSnapshot(actividadesPorCurso);

  const [crearOpen, setCrearOpen] = useState(false);
  const [cursoParaCrear, setCursoParaCrear] = useState<string | null>(null);
  const [asignaturaParaCrear, setAsignaturaParaCrear] = useState<string | null>(null);

  const [ordenPorCurso, setOrdenPorCurso] = useState<Record<string, "asc" | "desc">>({});
  const [verOpen, setVerOpen] = useState(false);
  const [actividadSel, setActividadSel] = useState<ActividadT | null>(null);

  useEffect(() => {
    if (!snapCursos.cursos || snapCursos.cursos.length === 0) {
      cursoStore.cargarCursos().catch(console.error);
    }
  }, [snapCursos.cursos?.length]);

  useEffect(() => {
    (snapCursos.cursos || []).forEach((c: Curso) => {
      if (c?.id) cargarActividades(c.id);
    });
  }, [snapCursos.cursos?.length]);

  const [filtroEstado, setFiltroEstado] = useState<EstadoUI | "todos">("todos");

  const getNombreAsignatura = (cursoId: string, asigId: string) => {
    const lista = snapAsignaturas[cursoId] || [];
    return lista.find((a: any) => a.id === asigId)?.nombre || asigId;
  };

  const actividadesOrdenadasPorCurso = useMemo(() => {
    const out: Record<string, ActividadT[]> = {};
    (snapCursos.cursos || []).forEach((c: Curso) => {
      const acts = (snapActividades[c.id] || []) as ActividadT[];
      const filtradas = acts.filter((a) => {
        if (filtroEstado === "todos") return true;
        const ev = a.estadoCanon ?? estadoUI(a);
        return ev === filtroEstado;
      });
      const orden = ordenPorCurso?.[c.id] ?? "desc";
      out[c.id] = [...filtradas].sort((a, b) => {
        const dA = +new Date(a.fecha);
        const dB = +new Date(b.fecha);
        return orden === "asc" ? dA - dB : dB - dA;
      });
    });
    return out;
  }, [snapCursos.cursos, snapActividades, filtroEstado, ordenPorCurso]);

  return (
    <main>
      {/* Filtro por estado */}
      <div className="min-w-[220px]">
        <Select
          value={filtroEstado}
          onValueChange={(v) => setFiltroEstado(v as EstadoUI | "todos")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="analizada">Analizada</SelectItem>
            <SelectItem value="programada">Programada</SelectItem>
            <SelectItem value="pendiente_evaluar">Pendiente de evaluar</SelectItem>
            <SelectItem value="evaluada">Evaluada</SelectItem>
            <SelectItem value="cerrada">Cerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de cursos */}
      <div className="px-4 pb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        {(snapCursos.cursos || []).map((curso: Curso) => {
          const actividades = actividadesOrdenadasPorCurso[curso.id] || [];
          const tituloCurso = curso.acronimo
            ? `${curso.acronimo} — ${curso.nombre ?? curso.id}`
            : curso.nombre ?? curso.id;

          return (
            <div key={curso.id} className="border border-zinc-800 bg-background rounded-lg p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold text-white truncate">{tituloCurso}</h2>
                  <div className="text-xs text-muted-foreground">
                    <Link className="underline hover:no-underline" href={`/cursos/${curso.id}/actividades`}>
                      Ver página del curso
                    </Link>
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {actividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pr-2">Actividad</TableHead>
                        <TableHead className="w-[240px]">Asignatura</TableHead>
                        <TableHead className="w-[170px]">Estado</TableHead>
                        <TableHead className="w-[80px] text-right">Media</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actividades.map((a) => {
                        const ev = a.estadoCanon ?? estadoUI(a);
                        return (
                          <TableRow
                            key={a.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setActividadSel(a);
                              setVerOpen(true);
                            }}
                          >
                            <TableCell className="w-[220px] pr-2 align-top">
                              <div className="font-bold text-xs whitespace-normal break-words" title={a.nombre}>
                                {a.nombre}
                              </div>
                            </TableCell>
                            <TableCell className="w-[260px] align-top">
                              <div className="text-xs whitespace-normal break-words">
                                <span className="text-zinc-400 font-mono">{a.asignaturaId}</span>{" "}
                                {getNombreAsignatura(curso.id, a.asignaturaId)}
                              </div>
                            </TableCell>
                            <TableCell className="w-[170px] align-top">
                              <EstadoBadge
                                estadoCanon={ev}
                                programadaPara={a.programadaPara}
                                analisisFecha={a.analisisFecha}
                                evaluadaFecha={a.evaluadaFecha}
                              />
                            </TableCell>
                            <TableCell className="w-[80px] text-right align-top">
                              {typeof a.notaMedia === "number" ? (
                                <span className="text-xs font-bold text-white">
                                  {a.notaMedia.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell
                              className="w-[90px] text-right align-top"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Borrar esta actividad?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      <span className="font-medium">{a.nombre}</span>
                                      <br />
                                      Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={async () => {
                                        try {
                                          const res = await (window as any).electronAPI.borrarActividad(a.id);
                                          if (!res?.ok) throw new Error(res?.error ?? "No se pudo borrar");
                                          await cargarActividades(curso.id);
                                          toast.success("Actividad borrada.");
                                        } catch (err: any) {
                                          toast.error(err?.message ?? "Error al borrar la actividad.");
                                        }
                                      }}
                                    >
                                      Borrar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

      <DialogCrearActividad
        open={crearOpen}
        onOpenChange={(v) => {
          setCrearOpen(v);
          if (!v) {
            setCursoParaCrear(null);
            setAsignaturaParaCrear(null);
          }
        }}
        cursoId={cursoParaCrear ?? undefined}
        asignaturaId={asignaturaParaCrear ?? undefined}
        setRefreshKey={async () => {
          if (cursoParaCrear) {
            await cargarActividades(cursoParaCrear);
            toast.success("Actividad creada.");
          }
        }}
      />

      <DialogVerActividad
        open={verOpen}
        onOpenChange={setVerOpen}
        actividad={actividadSel as any}
        asignaturaNombre={
          actividadSel
            ? (snapAsignaturas[actividadSel.cursoId] || []).find((a: any) => a.id === actividadSel.asignaturaId)?.nombre
            : undefined
        }
      />
    </main>
  );
}
