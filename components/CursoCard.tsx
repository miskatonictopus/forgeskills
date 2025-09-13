"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState, useRef} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};
const isVeryLight = (hex?: string | null) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return L > 0.85;
};
const pickColorProp = (obj: any): string | undefined =>
  obj?.color ?? obj?.colorHex ?? obj?.color_hex ?? obj?.colour ?? obj?.hex ?? obj?.themeColor ?? obj?.theme_color ?? undefined;
/* =================================================== */

type Curso = {
  id: string;
  acronimo: string;
  nombre: string;
  grado: string;
  clase: string;
  nivel: string;
};

type UIAlumno = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  mail?: string | null;
};

type Props = { curso: Curso };

export function CursoCard({ curso }: Props) {
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openCrear, setOpenCrear] = useState(false);

  // popover alumnos
  const [openAlumnos, setOpenAlumnos] = useState(false);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [alumnos, setAlumnos] = useState<UIAlumno[]>([]);
  const [alumnosError, setAlumnosError] = useState<string | null>(null);

  // popover checkboxes asignaturas
  const [openGestionAsig, setOpenGestionAsig] = useState(false);
  const [catalogoAsig, setCatalogoAsig] = useState<Array<{ id: string; nombre: string }>>([]);
  const [seleccionAsig, setSeleccionAsig] = useState<Record<string, boolean>>({});
  const [savingAsig, setSavingAsig] = useState(false);

  const [asigSeleccionada, setAsigSeleccionada] = useState<{ id: string; nombre: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();
  const asignaturas = asignaturasPorCurso[curso.id] || [];
  const tieneAsignaturas = asignaturas.length > 0;

  /* colores */
  const [colorByAsig, setColorByAsig] = useState<Record<string, string>>({});
  const asigHash = useMemo(
    () => (asignaturas || []).map(a => `${a.id}:${normalizeHex(pickColorProp(a)) || ""}`).join("|"),
    [asignaturas]
  );
const persistTimers = useRef<Record<string, any>>({});
  useEffect(() => {
    const onColor = (e: any) => {
      const { asignaturaId, color } = e?.detail || {};
      if (!asignaturaId) return;
  
      // Normaliza a #rrggbb (como haces en otras partes)
      const hex = normalizeHex(color);
      if (!hex) return;
  
      // 1) Estado local (evita renders si no hay cambio real)
      setColorByAsig(prev =>
        prev[asignaturaId] === hex ? prev : { ...prev, [asignaturaId]: hex }
      );
  
      // 2) Store por curso, para que tu UI interna se actualice
      try {
        const lista = (asignaturasPorCurso[curso.id] || []) as Array<Asignatura & { color?: string }>;
        const idx = lista.findIndex(a => String(a.id) === String(asignaturaId));
        if (idx !== -1) {
          const actual = normalizeHex(lista[idx]?.color);
          if (actual !== hex) {
            const nueva = [...lista];
            nueva[idx] = { ...nueva[idx], color: hex };
            setAsignaturasCurso(curso.id, nueva as any);
          }
        }
      } catch {}
  
      // 3) ✅ Persistencia en SQLite (debounced)
      try {
        const api = (window as any).electronAPI;
        const id = String(asignaturaId);
  
        // limpia cualquier timer previo para este id
        if (persistTimers.current[id]) clearTimeout(persistTimers.current[id]);
  
        persistTimers.current[id] = setTimeout(() => {
          api?.actualizarColorAsignatura?.(id, hex).catch(() => {/* noop */});
        }, 250);
      } catch {
        /* noop */
      }
    };
  
    window.addEventListener("asignatura:color:actualizado", onColor);
    return () => window.removeEventListener("asignatura:color:actualizado", onColor);
  }, [curso.id]);
  

  // carga asignaturas del curso
  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then(asigs => {
      setAsignaturasCurso(curso.id, asigs);
    });
  }, [curso.id, refreshKey]);

  // resolver colores
  useEffect(() => {
    if (!tieneAsignaturas) {
      if (Object.keys(colorByAsig).length) setColorByAsig({});
      return;
    }
    const initial: Record<string, string> = {};
    for (const a of asignaturas) {
      const c = normalizeHex(pickColorProp(a));
      if (c) initial[a.id] = c;
    }
    if (Object.keys(initial).length) {
      let changed = false;
      for (const [id, col] of Object.entries(initial)) {
        if (colorByAsig[id] !== col) { changed = true; break; }
      }
      if (changed) setColorByAsig(prev => ({ ...prev, ...initial }));
    }

    (async () => {
      try {
        const api = (window as any).electronAPI;
        if (api?.leerColoresAsignaturas) {
          const arr = await api.leerColoresAsignaturas(curso.id);
          const updates: Record<string, string> = {};
          for (const it of Array.isArray(arr) ? arr : []) {
            const id = String(it?.id ?? it?.asignaturaId ?? "");
            const col = normalizeHex(pickColorProp(it));
            if (!id || !col) continue;
            if (colorByAsig[id] !== col) updates[id] = col;
          }
          if (Object.keys(updates).length) { setColorByAsig(prev => ({ ...prev, ...updates })); return; }
        }
        for (const a of asignaturas) {
          if (initial[a.id]) continue;
          let det: any = null;
          if (api?.leerAsignatura) det = await api.leerAsignatura(a.id);
          else if (api?.getAsignatura) det = await api.getAsignatura(a.id);
          const col = normalizeHex(pickColorProp(det));
          if (col && colorByAsig[a.id] !== col) setColorByAsig(prev => ({ ...prev, [a.id]: col }));
        }
      } catch {}
    })();
  }, [asigHash, curso.id]);

  const abrirCrearActividad = (asig: { id: string; nombre: string }) => {
    setAsigSeleccionada(asig);
    setOpenCrear(true);
  };

  // alumnos (lazy)
  const handleOpenChangeAlumnos = async (open: boolean) => {
    setOpenAlumnos(open);
    if (!open) return;
    setAlumnosError(null);
    setLoadingAlumnos(true);
    try {
      const api = (window as any).electronAPI;
      const cursoIdNum = Number(curso.id);
      const idForIpc = Number.isFinite(cursoIdNum) ? cursoIdNum : curso.id;
      const list: any[] = await api.leerAlumnosPorCurso(idForIpc);
      const normalized: UIAlumno[] = (Array.isArray(list) ? list : []).map((x: any) => {
        const apellido =
          x.apellido ?? x.apellidos ??
          ([x.apellido1, x.apellido2].filter(Boolean).join(" ").trim() || null) ??
          x.last_name ?? x.lastname ?? null;
        return {
          id: String(x.id ?? x.alumno_id ?? x.uuid ?? ""),
          nombre: x.nombre ?? x.first_name ?? x.name ?? null,
          apellido,
          mail: x.mail ?? x.email ?? null,
        };
      });
      setAlumnos(normalized);
    } catch (e: any) {
      setAlumnosError(e?.message ?? "No se pudieron cargar los alumnos");
      setAlumnos([]);
    } finally {
      setLoadingAlumnos(false);
    }
  };

  // abrir gestión de asignaturas con checkboxes
  const onOpenGestionAsig = async (open: boolean) => {
    setOpenGestionAsig(open);
    if (!open) return;

    const api = (window as any).electronAPI;

    // 1) catálogo de asignaturas (intenta varios nombres comunes)
    let catalogo: any[] = [];
    try {
      catalogo =
        (await api.listarAsignaturasCatalogo?.()) ??
        (await api.obtenerAsignaturasCatalogo?.()) ??
        (await api.listarAsignaturas?.()) ??
        [];
    } catch {
      // si falla el catálogo, al menos muestra las actuales
      catalogo = [];
    }

    // Normaliza y mezcla: asegura que las actuales estén presentes
    const actuales = (asignaturas || []).map(a => ({ id: String(a.id), nombre: a.nombre }));
    const mapa: Record<string, { id: string; nombre: string }> = {};
    for (const it of catalogo) {
      const id = String(it.id ?? it.asignatura_id ?? "");
      const nombre = String(it.nombre ?? it.name ?? it.titulo ?? `Asignatura ${id}`);
      if (id) mapa[id] = { id, nombre };
    }
    for (const it of actuales) mapa[it.id] = it;

    const lista = Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    setCatalogoAsig(lista);

    // 2) preselecciona las que ya están en el curso
    const selected: Record<string, boolean> = {};
    for (const a of actuales) selected[a.id] = true;
    setSeleccionAsig(selected);
  };

  const toggleAsig = (id: string, checked: boolean | string) => {
    setSeleccionAsig(prev => ({ ...prev, [id]: !!checked }));
  };

  const guardarAsignaturas = async () => {
    setSavingAsig(true);
    try {
      const selectedIds = Object.entries(seleccionAsig).filter(([, v]) => v).map(([k]) => k);

      // diff con las actuales
      const actualesIds = new Set((asignaturas || []).map(a => String(a.id)));
      const nuevos = selectedIds.filter(id => !actualesIds.has(id));
      const quitar = [...actualesIds].filter(id => !selectedIds.includes(id));

      const api = (window as any).electronAPI;

      // ⚙️ Llama a tus IPC reales (ajusta nombres):
      if (nuevos.length && api?.asociarAsignaturasCurso) {
        await api.asociarAsignaturasCurso(curso.id, nuevos);
      }
      if (quitar.length && api?.desasociarAsignaturasCurso) {
        await api.desasociarAsignaturasCurso(curso.id, quitar);
      }

      // Guardado alternativo (si tienes un solo endpoint):
      if (api?.guardarAsignaturasDeCurso) {
        await api.guardarAsignaturasDeCurso(curso.id, selectedIds);
      }

      // Optimista en UI
      const nuevasAsigs: any[] = catalogoAsig
        .filter(a => selectedIds.includes(a.id))
        .map(a => ({ id: a.id, nombre: a.nombre }));

      setAsignaturasCurso(curso.id, nuevasAsigs as any);
      setOpenGestionAsig(false);
    } finally {
      setSavingAsig(false);
    }
  };

  return (
    <>
      <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative">
        <CardContent className="leading-tight space-y-3 pt-4">
          <div className="flex items-start gap-3">
            {/* Info del curso */}
            <div className="grow">
              <p className="text-4xl font-bold truncate uppercase">
                {curso.acronimo}{curso.nivel}
              </p>
              <p className="text-xs font-light text-zinc-400 uppercase">{curso.nombre}</p>
              <div className="flex items-center gap-4">
                <p className="text-xs font-light text-zinc-400">Grado: <span className="text-white uppercase">{curso.grado}</span></p>
                <p className="text-xs font-light text-zinc-400">Clase: <span className="text-white uppercase">{curso.clase}</span></p>
              </div>
            </div>

            {/* Botones alineados a la derecha */}
            <div className="ml-auto flex flex-col items-end gap-2 shrink-0">
              {/* Ver alumnos */}
              <Popover open={openAlumnos} onOpenChange={handleOpenChangeAlumnos}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 bg-zinc-800/60 border-zinc-700 text-zinc-100 hover:bg-zinc-700 text-xs">
                    Ver alumnos
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[560px] p-0 bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-2xl">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Alumnos del curso</p>
                    {!loadingAlumnos && !alumnosError && alumnos.length > 0 && (
                      <span className="ml-auto text-[11px] text-zinc-400">{alumnos.length}</span>
                    )}
                  </div>
                  <ScrollArea className="h-[420px]">
                    {loadingAlumnos && <div className="p-4 text-sm text-zinc-300">Cargando…</div>}
                    {!loadingAlumnos && alumnosError && <div className="p-4 text-sm text-red-300">{alumnosError}</div>}
                    {!loadingAlumnos && !alumnosError && alumnos.length > 0 && (
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="sticky top-0 bg-zinc-800 z-10 w-10 text-zinc-400">#</TableHead>
                            <TableHead className="sticky top-0 bg-zinc-800 z-10 text-zinc-400">Apellido</TableHead>
                            <TableHead className="sticky top-0 bg-zinc-800 z-10 text-zinc-400">Nombre</TableHead>
                            <TableHead className="sticky top-0 bg-zinc-800 z-10 text-zinc-400">Email</TableHead>
                            <TableHead className="sticky top-0 bg-zinc-800 z-10 text-right text-zinc-400">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {alumnos.map((al, i) => (
                            <TableRow key={al.id}>
                              <TableCell className="font-mono text-xs text-zinc-400">{i + 1}</TableCell>
                              <TableCell className="truncate">{al.apellido ?? "—"}</TableCell>
                              <TableCell className="truncate">{al.nombre ?? "—"}</TableCell>
                              <TableCell className="truncate">{al.mail ?? "—"}</TableCell>
                              <TableCell className="text-right">
                                <Link href={`/alumnos/${curso.id}?focus=${al.id}`} className="text-emerald-300 hover:underline text-xs">
                                  Abrir
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {!loadingAlumnos && !alumnosError && alumnos.length === 0 && (
                      <div className="p-4 text-sm text-zinc-300">Este curso no tiene alumnos todavía.</div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Ver asignaturas */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 bg-zinc-800/60 border-zinc-700 text-zinc-100 hover:bg-zinc-700 text-xs">
                    Ver asignaturas
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0 bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-2xl">
                  <div className="p-3 border-b border-zinc-800">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Asignaturas ({asignaturas.length})</p>
                  </div>
                  {tieneAsignaturas ? (
                    <ul className="max-h-80 overflow-auto p-2 text-xs">
                      {asignaturas.map(a => {
                        const color = colorByAsig[a.id];
                        const hasColor = !!color;
                        const borderTone = hasColor && isVeryLight(color) ? "border-black/30" : "border-white/20";
                        return (
                          <li key={a.id} className="list-none">
                            <Link href={`/cursos/${curso.id}/asignaturas/${a.id}`} className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-zinc-800/60 transition-colors">
                              <span
                                className={`h-3.5 w-3.5 rounded-full border ${hasColor ? borderTone : "border-zinc-600"}`}
                                style={{ backgroundColor: hasColor ? color : "transparent" }}
                                title={hasColor ? color : "Sin color"}
                              />
                              <span className="truncate">{a.nombre}</span>
                              <span className="ml-auto text-[11px] text-zinc-400">#{a.id}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-3 text-sm text-zinc-300">
                      <p className="mb-2">Este curso aún no tiene asignaturas.</p>
                      <Button size="sm" className="w-full bg-white text-black hover:bg-gray-100" onClick={() => setOpenAdd(true)}>
                        Añadir asignatura/s
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Editar (checkboxes) */}
              <Popover open={openGestionAsig} onOpenChange={onOpenGestionAsig}>
                <PopoverTrigger asChild>
                  <Button size="sm" className="h-8 text-xs bg-white text-black hover:bg-gray-100">
                    Editar asignaturas
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[420px] p-0 bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-2xl">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Añadir / quitar asignaturas</p>
                    <span className="text-[11px] text-zinc-400">
                      Seleccionadas: {Object.values(seleccionAsig).filter(Boolean).length}
                    </span>
                  </div>
                  <ScrollArea className="h-[360px]">
                    <ul className="p-2 space-y-1">
                      {catalogoAsig.length === 0 && (
                        <li className="px-3 py-2 text-sm text-zinc-300">
                          No hay catálogo disponible. (Ajusta la llamada IPC de catálogo)
                        </li>
                      )}
                      {catalogoAsig.map(a => (
                        <li key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-zinc-800/60">
                          <Checkbox
                            checked={!!seleccionAsig[a.id]}
                            onCheckedChange={(v) => toggleAsig(a.id, v)}
                            className="border-zinc-600 data-[state=checked]:bg-white data-[state=checked]:text-black"
                          />
                          <span className="text-sm truncate">{a.nombre}</span>
                          <span className="ml-auto text-[11px] text-zinc-400">#{a.id}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                  <div className="p-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8 border-zinc-700 text-zinc-100" onClick={() => setOpenGestionAsig(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" className="h-8 bg-white text-black hover:bg-gray-100" disabled={savingAsig} onClick={guardarAsignaturas}>
                      {savingAsig ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Separator className="my-2" />

          {/* CTA cuando no hay asignaturas */}
          {!(asignaturas?.length > 0) && (
            <Button
              size="sm"
              aria-label="Asociar asignaturas"
              className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-md bg-white text-black hover:bg-gray-100 transition-all"
              onClick={() => setOpenAdd(true)}
            >
              Añadir asignatura/s
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dialogs (siguen disponibles si quieres usarlos) */}
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
