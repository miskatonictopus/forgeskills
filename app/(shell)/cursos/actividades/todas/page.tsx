"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSnapshot } from "valtio";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  evaluadaFecha,               // 👈 la recibimos
}: {
  estadoCanon?: EstadoUI;
  programadaPara?: string | null;
  analisisFecha?: string | null;
  evaluadaFecha?: string | null; // 👈 tipada
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

  // 👇 ahora sí: usamos evaluadaFecha cuando ev === 'evaluada'
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
  // stores
  const snapCursos = useSnapshot(cursoStore);
  const snapAsignaturas = useSnapshot(asignaturasPorCurso);
  const snapActividades = useSnapshot(actividadesPorCurso);

  // diálogos
  const [crearOpen, setCrearOpen] = useState(false);
  const [cursoParaCrear, setCursoParaCrear] = useState<string | null>(null);
  const [asignaturaParaCrear, setAsignaturaParaCrear] = useState<string | null>(null);

  const [ordenPorCurso, setOrdenPorCurso] = useState<Record<string, "asc" | "desc">>({});
  const [verOpen, setVerOpen] = useState(false);
  const [actividadSel, setActividadSel] = useState<ActividadT | null>(null);

  // cargar cursos y actividades
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

  // helper nombre asignatura
  const getNombreAsignatura = (cursoId: string, asigId: string) => {
    const lista = snapAsignaturas[cursoId] || [];
    return lista.find((a: any) => a.id === asigId)?.nombre || asigId;
  };

  // ordenar actividades por fecha desc
  const actividadesOrdenadasPorCurso = useMemo(() => {
    const out: Record<string, ActividadT[]> = {};
    (snapCursos.cursos || []).forEach((c: Curso) => {
      const acts = (snapActividades[c.id] || []) as ActividadT[];
  
      // 👉 filtro por estado
      const filtradas = acts.filter((a) => {
        if (filtroEstado === "todos") return true;
        const ev = a.estadoCanon ?? estadoUI(a);
        return ev === filtroEstado;
      });
  
      // 👉 orden por fecha según tu ordenPorCurso (si lo pusiste) o desc por defecto
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
              <div
                key={curso.id}
                className="border border-zinc-800 bg-background rounded-lg p-4 shadow-sm flex flex-col"
              >
                {/* Header de la card del curso */}
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold text-white truncate">{tituloCurso}</h2>
                    <div className="text-xs text-muted-foreground">
                      <Link className="underline hover:no-underline" href={`/cursos/${curso.id}/actividades`}>
                        Ver página del curso
                      </Link>
                    </div>
                  </div>

                  {/* Si quieres reactivar el botón de crear, descomenta: */}
                  {/* <Button
                    size="sm"
                    className="px-2.5 py-2 mt-1 rounded-md bg-white text-black text-xs hover:bg-gray-100"
                    onClick={() => {
                      setCursoParaCrear(curso.id);
                      setAsignaturaParaCrear(null);
                      setCrearOpen(true);
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Crear actividad
                  </Button> */}
                </div>

                <Separator className="my-3" />

                {/* Tabla de actividades del curso */}
                {actividades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
                ) : (
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <Table className="w-full">
                    <TableHeader>
  <TableRow>
    <TableHead className="pr-2">
      <div className="flex items-center gap-1">
        <span>Actividad</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-800"
                onClick={() =>
                  setOrdenPorCurso((prev) => ({
                    ...prev,
                    [curso.id]: (prev[curso.id] ?? "desc") === "desc" ? "asc" : "desc",
                  }))
                }
                aria-label="Cambiar orden por fecha"
                title="Cambiar orden por fecha"
              >
                {(ordenPorCurso[curso.id] ?? "desc") === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {(ordenPorCurso[curso.id] ?? "desc") === "desc"
                ? "Orden: más nuevas primero"
                : "Orden: más antiguas primero"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </TableHead>

    <TableHead className="w-[240px]">Asignatura</TableHead>
    <TableHead className="w-[170px]">Estado</TableHead>
    <TableHead className="w-[80px] text-right">Media</TableHead>
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
                              {/* Actividad */}
                              <TableCell className="w-[220px] pr-2 align-top">
                                <div className="font-bold text-xs whitespace-normal break-words" title={a.nombre}>
                                  {a.nombre}
                                </div>
                              </TableCell>

                              {/* Asignatura (ID + nombre) */}
                              <TableCell className="w-[260px] align-top">
                                <div className="text-xs whitespace-normal break-words">
                                  <span className="text-zinc-400 font-mono">{a.asignaturaId}</span>{" "}
                                  {getNombreAsignatura(curso.id, a.asignaturaId)}
                                </div>
                              </TableCell>

                              {/* Estado */}
                              <TableCell className="w-[170px] align-top">
                                <EstadoBadge
                                  estadoCanon={ev}
                                  programadaPara={a.programadaPara}
                                  analisisFecha={a.analisisFecha}
                                  evaluadaFecha={a.evaluadaFecha}
                                />
                              </TableCell>

                              {/* Media */}
                              <TableCell className="w-[80px] text-right align-top">
  {typeof a.notaMedia === "number" ? (
    <span className="text-xs font-bold text-white">
      {a.notaMedia.toFixed(1)}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
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

        {/* Diálogo crear (contexto curso seleccionado) */}
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

        {/* Diálogo ver actividad */}
        <DialogVerActividad
          open={verOpen}
          onOpenChange={setVerOpen}
          actividad={actividadSel as any}
          asignaturaNombre={
            actividadSel
              ? (snapAsignaturas[actividadSel.cursoId] || []).find((a: any) => a.id === actividadSel.asignaturaId)
                  ?.nombre
              : undefined
          }
        />
        
        </main>
  );
}
