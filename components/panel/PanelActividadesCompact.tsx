// components/panel/PanelActividadesCompact.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Dot } from "@/components/ui/Dot"
import { useSnapshot } from "valtio";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { actividadesPorCurso, cargarActividades } from "@/store/actividadesPorCurso";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogVerActividad } from "@/components/actividades/DialogVerActividad";

type Curso = { id: string; nombre?: string };

type Actividad = {
  id: string;
  nombre: string;
  fecha: string;
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;
  estado?: "borrador" | "analizada" | "enviada" | "pendiente" | "evaluada";
  analisisFecha?: string | null;
};

function EstadoDot({ estado }: { estado?: string }) {
  const map: Record<string, string> = {
    analizada: "bg-emerald-500",
    enviada: "bg-sky-500",
    pendiente: "bg-amber-500",
    evaluada: "bg-violet-500",
    borrador: "bg-zinc-500",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", map[estado ?? "borrador"])}/>;
}

export function PanelActividadesCompact({ cursos }: { cursos: Curso[] }) {
  const asigSnap = useSnapshot(asignaturasPorCurso);
  const actsSnap = useSnapshot(actividadesPorCurso);

  // diálogo ver
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Actividad | null>(null);
  const [asigNombreSel, setAsigNombreSel] = useState<string | undefined>();

  // paginación por (curso, asignatura)
  const [pageBy, setPageBy] = useState<Record<string, number>>({});
  const pageSize = 4;
  const keyFor = (cursoId: string, asigId: string) => `${cursoId}::${asigId}`;

  const setPage = (k: string, n: number) =>
    setPageBy((s) => ({ ...s, [k]: Math.max(0, n) }));

  useEffect(() => {
    for (const c of cursos) cargarActividades(c.id);
  }, [cursos]);

  return (
    <>
      <div className="flex flex-col gap-4">
        {cursos.map((curso) => {
          const asignaturas = asigSnap[curso.id] || [];
          const actividades: Actividad[] = (actsSnap[curso.id] || []) as any;

          const byAsig: Record<string, Actividad[]> = {};
          for (const a of actividades) (byAsig[a.asignaturaId] ||= []).push(a);

          const defaultTab = asignaturas[0]?.id ?? "none";

          return (
            <div
              key={curso.id}
              className="rounded-lg border border-zinc-800 bg-background/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xl font-bold text-white">
                  {curso.id} {curso.nombre}
                </div>
                <Badge variant="secondary">{actividades.length} actividades</Badge>
              </div>

              {asignaturas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin asignaturas.</p>
              ) : (
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto">
  {asignaturas.map((asig) => (
    <TabsTrigger key={asig.id} value={asig.id} className="text-xs">
      <span className="flex items-center gap-2">
        <Dot color={asig.color ?? "#9ca3af"} className="w-2.5 h-2.5" />
        {asig.nombre}
      </span>
    </TabsTrigger>
  ))}
</TabsList>

                  {asignaturas.map((asig) => {
                    const all = (byAsig[asig.id] || []).sort(
                      (a, b) => +new Date(b.fecha) - +new Date(a.fecha)
                    );
                    const k = keyFor(curso.id, asig.id);
                    const page = pageBy[k] ?? 0;
                    const start = page * pageSize;
                    const items = all.slice(start, start + pageSize);
                    const hasPrev = page > 0;
                    const hasNext = start + pageSize < all.length;

                    return (
                      <TabsContent key={asig.id} value={asig.id} className="mt-3">
                        {all.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sin actividades para esta asignatura.
                          </p>
                        ) : (
                          <>
                            <ul className="flex flex-col gap-2">
                              {items.map((a) => (
                                <li
                                  key={a.id}
                                  className="rounded-md border border-zinc-800 p-3 hover:bg-zinc-900/40 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium truncate" title={a.nombre}>
                                        {a.nombre}
                                      </div>
                                      {a.descripcion ? (
                                        <div
                                          className="text-xs text-muted-foreground line-clamp-1"
                                          title={a.descripcion}
                                        >
                                          {a.descripcion}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="text-[11px] tabular-nums text-zinc-400">
                                      {new Date(a.fecha).toLocaleDateString("es-ES")}
                                    </div>
                                  </div>

                                  <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <EstadoDot estado={a.estado} />
                                      <span className="capitalize">{a.estado ?? "borrador"}</span>
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        setSel(a);
                                        setAsigNombreSel(asig.nombre);
                                        setOpen(true);
                                      }}
                                    >
                                      Ver
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>

                            {/* Controles de página */}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {start + 1}–{Math.min(start + pageSize, all.length)}{" "}
                                de {all.length}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setPage(k, page - 1)}
                                  disabled={!hasPrev}
                                >
                                  Anterior
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setPage(k, page + 1)}
                                  disabled={!hasNext}
                                >
                                  Siguiente
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>
          );
        })}
      </div>

      <DialogVerActividad
        open={open}
        onOpenChange={setOpen}
        actividad={sel as any}
        asignaturaNombre={asigNombreSel}
      />
    </>
  );
}
