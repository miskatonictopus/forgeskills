"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // 👈 NUEVO
import { Users, BookA, PlusCircle } from "lucide-react";
import { DialogAsignaturas } from "@/components/DialogAsignaturas";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad";
import {
  asignaturasPorCurso,
  setAsignaturasCurso,
} from "@/store/asignaturasPorCurso";
import type { Asignatura } from "@/models/asignatura";
import { alumnosStore, cargarAlumnosCurso } from "@/store/alumnosStore";
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
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
};
const isVeryLight = (hex?: string | null) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
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

  // estado popover alumnos
  const [openAlumnos, setOpenAlumnos] = useState(false); // 👈 NUEVO
  const [loadingAlumnos, setLoadingAlumnos] = useState(false); // 👈 NUEVO
  const [alumnos, setAlumnos] = useState<UIAlumno[]>([]); // 👈 NUEVO
  const [alumnosError, setAlumnosError] = useState<string | null>(null); // 👈 NUEVO

  const [asigSeleccionada, setAsigSeleccionada] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();
  const asignaturas = asignaturasPorCurso[curso.id] || [];
  const tieneAsignaturas = asignaturas.length > 0;

  /* 🔧 color state */
  const [colorByAsig, setColorByAsig] = useState<Record<string, string>>({});
  const asigHash = useMemo(() => {
    return (asignaturas || [])
      .map((a) => `${a.id}:${normalizeHex(pickColorProp(a)) || ""}`)
      .join("|");
  }, [asignaturas]);

  /* listener cambios color */
  useEffect(() => {
    const onColor = (e: any) => {
      const { asignaturaId, color } = e?.detail || {};
      if (!asignaturaId) return;

      setColorByAsig((prev) =>
        prev[asignaturaId] === color ? prev : { ...prev, [asignaturaId]: color }
      );

      try {
        const lista = (asignaturasPorCurso[curso.id] || []) as Array<
          Asignatura & { color?: string }
        >;
        const idx = lista.findIndex(
          (a) => String(a.id) === String(asignaturaId)
        );
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
    return () =>
      window.removeEventListener("asignatura:color:actualizado", onColor);
  }, [curso.id]);

  // carga asignaturas
  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then((asigs) => {
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
        if (colorByAsig[id] !== col) {
          changed = true;
          break;
        }
      }
      if (changed) setColorByAsig((prev) => ({ ...prev, ...initial }));
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
          if (Object.keys(updates).length) {
            setColorByAsig((prev) => ({ ...prev, ...updates }));
            return;
          }
        }

        for (const a of asignaturas) {
          if (initial[a.id]) continue;
          let det: any = null;
          if (api?.leerAsignatura) det = await api.leerAsignatura(a.id);
          else if (api?.getAsignatura) det = await api.getAsignatura(a.id);
          const col = normalizeHex(pickColorProp(det));
          if (col && colorByAsig[a.id] !== col) {
            setColorByAsig((prev) => ({ ...prev, [a.id]: col }));
          }
        }
      } catch {
        /* noop */
      }
    })();
  }, [asigHash, curso.id]);

  const abrirCrearActividad = (asig: { id: string; nombre: string }) => {
    setAsigSeleccionada(asig);
    setOpenCrear(true);
  };

  // 👉 Carga perezosa de alumnos al abrir el Popover
  const handleOpenChangeAlumnos = async (open: boolean) => {
    setOpenAlumnos(open);
    if (!open) return;

    setAlumnosError(null);
    setLoadingAlumnos(true);

    try {
      const api = (window as any).electronAPI;
      const cursoIdNum = Number(curso.id);
      const idForIpc = Number.isFinite(cursoIdNum) ? cursoIdNum : curso.id;

      // ✅ usar lo que ya existe en preload/main
      const list: any[] = await api.leerAlumnosPorCurso(idForIpc);

      const normalized: UIAlumno[] = (Array.isArray(list) ? list : []).map(
        (x: any) => {
          const apellido =
            x.apellido ??
            x.apellidos ??
            ([x.apellido1, x.apellido2].filter(Boolean).join(" ").trim() ||
              null) ??
            x.last_name ??
            x.lastname ??
            null;

          return {
            id: String(x.id ?? x.alumno_id ?? x.uuid ?? ""),
            nombre: x.nombre ?? x.first_name ?? x.name ?? null,
            apellido,
            mail: x.mail ?? x.email ?? null,
          };
        }
      );

      setAlumnos(normalized);
    } catch (e: any) {
      setAlumnosError(e?.message ?? "No se pudieron cargar los alumnos");
      setAlumnos([]);
    } finally {
      setLoadingAlumnos(false);
    }
  };

  return (
    <>
      <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative">
        {/* ICONOS ACCIONES */}
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          {/* Popover ALUMNOS */}
          <Popover open={openAlumnos} onOpenChange={handleOpenChangeAlumnos}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Ver alumnos"
                    className="text-zinc-400 hover:text-emerald-400"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Ver alumnos</TooltipContent>
            </Tooltip>

            <PopoverContent
  align="end"
  className="w-[560px] p-0 bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-2xl"
>
  {/* Header fijo (no entra en el scroll) */}
  <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
    <p className="text-xs uppercase tracking-wide text-zinc-400">Alumnos del curso</p>
    {!loadingAlumnos && !alumnosError && alumnos.length > 0 && (
      <span className="ml-auto text-[11px] text-zinc-400">{alumnos.length}</span>
    )}
  </div>

  {/* Área scrollable */}
  <ScrollArea className="h-[420px]">
    {loadingAlumnos && <div className="p-4 text-sm text-zinc-300">Cargando…</div>}
    {!loadingAlumnos && alumnosError && (
      <div className="p-4 text-sm text-red-300">{alumnosError}</div>
    )}

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
                <Link
                  href={`/alumnos/${curso.id}?focus=${al.id}`}
                  className="text-emerald-300 hover:underline text-xs"
                >
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

          {/* Popover ASIGNATURAS (tu BookA tal cual) */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Ver asignaturas"
                    className="text-zinc-400 hover:text-sky-400"
                  >
                    <BookA className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Ver asignaturas</TooltipContent>
            </Tooltip>

            <PopoverContent
              align="end"
              className="w-80 p-0 bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-2xl"
            >
              <div className="p-3 border-b border-zinc-800">
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  Asignaturas ({asignaturas.length})
                </p>
              </div>

              {tieneAsignaturas ? (
                <ul className="max-h-80 overflow-auto p-2 text-xs">
                  {asignaturas.map((a) => {
                    const color = colorByAsig[a.id];
                    const hasColor = !!color;
                    const borderTone =
                      hasColor && isVeryLight(color)
                        ? "border-black/30"
                        : "border-white/20";
                    return (
                      <li key={a.id} className="list-none">
                        <Link
                          href={`/cursos/${curso.id}/asignaturas/${a.id}`}
                          className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-zinc-800/60 transition-colors"
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded-full border ${hasColor ? borderTone : "border-zinc-600"}`}
                            style={{
                              backgroundColor: hasColor ? color : "transparent",
                            }}
                            title={hasColor ? color : "Sin color"}
                          />
                          <span className="truncate">{a.nombre}</span>
                          <span className="ml-auto text-[11px] text-zinc-400">
                            #{a.id}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-3 text-sm text-zinc-300">
                  <p className="mb-2">Este curso aún no tiene asignaturas.</p>
                  <Button
                    size="sm"
                    className="w-full bg-white text-black hover:bg-gray-100"
                    onClick={() => setOpenAdd(true)}
                  >
                    <PlusCircle className="w-4 h-4 mr-1" />
                    Añadir asignatura/s
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* CONTENIDO */}
        <CardContent className="leading-tight space-y-1">
          <div>
            <p className="text-4xl font-bold truncate uppercase">
              {curso.acronimo}
              {curso.nivel}
            </p>
            <p className="text-xs font-light text-zinc-400 uppercase">
              {curso.nombre}
            </p>
            <div className="flex items-center gap-4">
              <p className="text-xs font-light text-zinc-400">
                Grado:{" "}
                <span className="text-white uppercase">{curso.grado}</span>
              </p>
              <p className="text-xs font-light text-zinc-400">
                Clase:{" "}
                <span className="text-white uppercase">{curso.clase}</span>
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          {/* CTA cuando no hay asignaturas */}
          {!(asignaturas?.length > 0) && (
            <Button
              size="sm"
              aria-label="Asociar asignaturas"
              className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-md bg-white text-black hover:bg-gray-100 transition-all"
              onClick={() => setOpenAdd(true)}
            >
              <PlusCircle className="w-4 h-4" />
              Añadir asignatura/s
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DialogAsignaturas
        cursoId={curso.id}
        open={openAdd}
        onOpenChange={setOpenAdd}
        mode="add"
      />
      <DialogAsignaturas
        cursoId={curso.id}
        open={openEdit}
        onOpenChange={setOpenEdit}
        mode="edit"
      />
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
