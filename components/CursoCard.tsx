"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Users, SquarePen, PlusCircle, ClipboardList } from "lucide-react";
import { DialogAsignaturas } from "@/components/DialogAsignaturas";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import { asignaturasPorCurso, setAsignaturasCurso } from "@/store/asignaturasPorCurso";
import type { Asignatura } from "@/models/asignatura";

/* ================= helpers color ================= */


const normalizeHex = (v?: string | null) => {
  if (!v) return "";
  let s = v.trim();
  if (!s) return "";
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s.toLowerCase();
};
const hexToRgb = (hex?: string | null): [number, number, number] | null => {
  const h = normalizeHex(hex);
  if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
};
const isVeryLight = (hex?: string | null) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r,g,b] = rgb;
  const L = 0.2126*(r/255) + 0.7152*(g/255) + 0.0722*(b/255);
  return L > 0.85;
};
const pickColorProp = (obj: any): string | undefined => {
  if (!obj) return undefined;
  return (
    obj.color ??
    obj.colorHex ??
    obj.color_hex ??
    obj.colour ??
    obj.hex ??
    obj.themeColor ??
    obj.theme_color ??
    undefined
  );
};
/* =================================================== */

type Curso = {
  id: string;
  acronimo: string;
  nombre: string;
  grado: string;
  clase: string;
  nivel: string;
};



type Props = { curso: Curso };

export function CursoCard({ curso }: Props) {
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [openCrear, setOpenCrear] = useState(false);
  const [asigSeleccionada, setAsigSeleccionada] = useState<{ id: string; nombre: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();
  const asignaturas = asignaturasPorCurso[curso.id] || [];
  const tieneAsignaturas = asignaturas.length > 0;

  /* 🔧 MOVER ARRIBA: estado usado por efectos siguientes */
  const [colorByAsig, setColorByAsig] = useState<Record<string, string>>({});
  const asigHash = useMemo(() => {
    return (asignaturas || [])
      .map(a => `${a.id}:${normalizeHex(pickColorProp(a)) || ""}`)
      .join("|");
  }, [asignaturas]);
  
  /* listener de cambios de color (dep solo curso.id) */
  useEffect(() => {
    const onColor = (e: any) => {
      const { asignaturaId, color } = e?.detail || {};
      if (!asignaturaId) return;

      // 1) pinta el círculo inmediatamente
      setColorByAsig(prev => {
        if (prev[asignaturaId] === color) return prev;
        return { ...prev, [asignaturaId]: color };
      });

      // 2) sincroniza el store SOLO si hace falta
      try {
        const lista = (asignaturasPorCurso[curso.id] || []) as Array<Asignatura & { color?: string }>;
        const idx = lista.findIndex(a => String(a.id) === String(asignaturaId));
        if (idx !== -1) {
          const actual = lista[idx]?.color;
          if (actual !== color) {
            const nueva = [...lista];
            nueva[idx] = { ...nueva[idx], color };
            setAsignaturasCurso(curso.id, nueva as any);
          }
        }
      } catch {
        /* noop */
      }
    };

    window.addEventListener("asignatura:color:actualizado", onColor);
    return () => window.removeEventListener("asignatura:color:actualizado", onColor);
  }, [curso.id]);

  // carga asignaturas base
  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then((asigs) => {
      setAsignaturasCurso(curso.id, asigs);
    });
  }, [curso.id, refreshKey]);


  // resuelve colores (usa lo que venga y completa con API si falta)
  useEffect(() => {
    if (!tieneAsignaturas) {
      // solo si hace falta
      if (Object.keys(colorByAsig).length) setColorByAsig({});
      return;
    }
  
    // 1) Colores que ya vienen en cada item
    const initial: Record<string, string> = {};
    for (const a of asignaturas) {
      const c = normalizeHex(pickColorProp(a));
      if (c) initial[a.id] = c;
    }
  
    // ✅ aplicar solo si hay diferencias reales con el estado actual
    if (Object.keys(initial).length) {
      let changed = false;
      for (const [id, col] of Object.entries(initial)) {
        if (colorByAsig[id] !== col) { changed = true; break; }
      }
      if (changed) {
        setColorByAsig(prev => ({ ...prev, ...initial }));
      }
    }
  
    (async () => {
      try {
        const api = (window as any).electronAPI;
  
        // 2) Batch
        if (api?.leerColoresAsignaturas) {
          const arr = await api.leerColoresAsignaturas(curso.id);
          const updates: Record<string, string> = {};
          for (const it of Array.isArray(arr) ? arr : []) {
            const id = String(it?.id ?? it?.asignaturaId ?? "");
            const col = normalizeHex(pickColorProp(it));
            if (!id || !col) continue;
            if (colorByAsig[id] !== col) updates[id] = col; // ✅ sólo diferencias
          }
          if (Object.keys(updates).length) {
            setColorByAsig(prev => ({ ...prev, ...updates }));
            return;
          }
        }
  
        // 3) Fallback por asignatura (sólo si falta y cambia)
        for (const a of asignaturas) {
          if (initial[a.id]) continue; // ya lo teníamos del paso 1
          let det: any = null;
          if (api?.leerAsignatura) det = await api.leerAsignatura(a.id);
          else if (api?.getAsignatura) det = await api.getAsignatura(a.id);
          const col = normalizeHex(pickColorProp(det));
          if (col && colorByAsig[a.id] !== col) {
            setColorByAsig(prev => ({ ...prev, [a.id]: col }));
          }
        }
      } catch { /* noop */ }
    })();
  
  // 👇 deps ESTABLES: el hash y el curso, no el array entero ni el objeto de colores sin control
  }, [asigHash, curso.id]); 
  


  const abrirCrearActividad = (asig: { id: string; nombre: string }) => {
    setAsigSeleccionada(asig);
    setOpenCrear(true);
  };

  return (
    <>
      <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative">
        {/* ICONOS ACCIONES */}
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Ver alumnos"
                className="text-zinc-400 hover:text-emerald-400"
                onClick={() => router.push(`/alumnos/${curso.id}`)}
              >
                <Users className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Ver alumnos</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-zinc-400 hover:text-emerald-400">
                <SquarePen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Editar curso</TooltipContent>
          </Tooltip>
        </div>

        {/* CONTENIDO */}
        <CardContent className="leading-tight space-y-1">
          <div>
            <p className="text-4xl font-bold truncate uppercase">
              {curso.acronimo}
              {curso.nivel}
            </p>
            <p className="text-xs font-light text-zinc-400 uppercase">{curso.nombre}</p>
            <div className="flex items-center gap-4">
              <p className="text-xs font-light text-zinc-400">
                Grado: <span className="text-white uppercase">{curso.grado}</span>
              </p>
              <p className="text-xs font-light text-zinc-400">
                Clase: <span className="text-white uppercase">{curso.clase}</span>
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          {!tieneAsignaturas ? (
            <Button
              size="sm"
              aria-label="Asociar asignaturas"
              className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-md bg-white text-black hover:bg-gray-100 transition-all"
              onClick={() => setOpenAdd(true)}
            >
              <PlusCircle className="w-4 h-4" />
              Añadir asignatura/s
            </Button>
          ) : (
            <div className="pt-2 space-y-2 text-xs leading-tight pb-2">
              <ul className="pl-0 space-y-2">
                {asignaturas.map((a) => {
                  const color = colorByAsig[a.id];
                  const hasColor = !!color;
                  const borderTone = hasColor && isVeryLight(color) ? "border-black/30" : "border-white/20";

                  return (
                    <li key={a.id} className="list-none -mx-2 p-2 rounded-md hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-muted-foreground mt-[2px]">0{a.id}</span>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`mt-[3px] h-3.5 w-3.5 rounded-full border shrink-0 ${hasColor ? borderTone : "border-zinc-600"}`}
                                style={{ backgroundColor: hasColor ? color : "transparent" }}
                                aria-label={hasColor ? `Color ${color}` : "Sin color"}
                                title={hasColor ? color : "Sin color"}
                              />
                            </TooltipTrigger>
                            {hasColor && <TooltipContent side="top">{color}</TooltipContent>}
                          </Tooltip>

                          <span className="text-white">{a.nombre}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Crear actividad para ${a.nombre}`}
                          className="h-7 text-emerald-200 hover:text-emerald-200 hover:bg-emerald-900/20 gap-1 text-xs"
                          onClick={() => abrirCrearActividad(a)}
                        >
                          <PlusCircle className="w-4 h-4" />
                          Crear actividad
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Button
                size="sm"
                aria-label="Modificar asignaturas"
                className="mt-2 inline-flex items-center gap-2 bg-white text-black hover:bg-gray-100 px-3 py-2 text-xs rounded-md shadow-sm"
                onClick={() => setOpenEdit(true)}
              >
                <SquarePen className="w-4 h-4" />
                Modificar asignaturas
              </Button>
            </div>
          )}

          <Separator className="my-4" />
        </CardContent>

        <div className="p-3 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium uppercase text-muted-foreground hover:text-white inline-flex items-center gap-1 transition-colors"
            onClick={() => router.push(`/cursos/${curso.id}/actividades`)}
          >
            <ClipboardList className="w-4 h-4" />
            Ver actividades
            <span className="text-xs text-zinc-400 ml-1">(0)</span>
          </Button>
        </div>
      </Card>

      <DialogAsignaturas cursoId={curso.id} open={openAdd} onOpenChange={setOpenAdd} mode="add" />
      <DialogAsignaturas cursoId={curso.id} open={openEdit} onOpenChange={setOpenEdit} mode="edit" />

      <DialogCrearActividad
        open={openCrear}
        onOpenChange={setOpenCrear}
        cursoId={curso.id}
        setRefreshKey={setRefreshKey}
        asignaturaId={asigSeleccionada?.id}
      />
    </>
  );
}
