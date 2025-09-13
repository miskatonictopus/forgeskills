"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso, setAsignaturasCurso } from "@/store/asignaturasPorCurso";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/Dot";
import {
  Folder,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  BookA,
  ClipboardList,
  Users,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

type Props = {
  setCursoAEliminar: (curso: { id: string; nombre: string }) => void;
};

/* =========== helpers color =========== */
const normalizeHex = (v?: string | null) => {
  if (!v) return "";
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/i.test(s) ? s : "";
};
// id con/sin ceros al inicio
const slim = (id: string) => String(id).replace(/^0+/, "") || "0";
/* ===================================== */

export function NavCursos({ setCursoAEliminar }: Props) {
  const { isMobile } = useSidebar();
  const snap = useSnapshot(cursoStore);

  // popover
  const [openCursoId, setOpenCursoId] = useState<string | null>(null);
  const [hoverLock, setHoverLock] = useState(false);
  const closeAll = () => !hoverLock && setOpenCursoId(null);

  // 💾 mapa global de colores (persistido)
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const primed = useRef(false);

  useEffect(() => {
    cursoStore.cargarCursos();
  }, []);

  // 1) Hidratar todos los colores desde SQLite una vez
  useEffect(() => {
    (async () => {
      if (primed.current) return;
      primed.current = true;
      try {
        const rows: any[] = await (window as any).electronAPI?.listarColoresAsignaturas?.();
        if (!rows) return;
        const map: Record<string, string> = {};
        for (const r of rows) {
          const id = String(r.id);
          const hex = normalizeHex(r.color);
          if (!hex) continue;
          map[id] = hex;         // con ceros
          map[slim(id)] = hex;   // sin ceros
        }
        if (Object.keys(map).length) setColorMap(map);
      } catch {/* noop */}
    })();
  }, []);

  // 2) Escuchar cambios de color en vivo y reflejarlos
  useEffect(() => {
    const onColor = (e: any) => {
      const { asignaturaId, color } = e?.detail || {};
      const id = String(asignaturaId || "");
      const hex = normalizeHex(color);
      if (!id || !hex) return;

      // mapa local
      setColorMap(prev => ({ ...prev, [id]: hex, [slim(id)]: hex }));

      // opcional: refrescar store para que otros sitios vean el cambio al instante
      try {
        for (const cursoId of Object.keys(asignaturasPorCurso)) {
          const lista = asignaturasPorCurso[cursoId] || [];
          const idx = lista.findIndex(a => String(a.id) === id || slim(String(a.id)) === slim(id));
          if (idx >= 0) {
            const nueva = [...lista];
            nueva[idx] = { ...nueva[idx], color: hex };
            setAsignaturasCurso(cursoId, nueva as any);
          }
        }
      } catch {/* noop */}
    };
    window.addEventListener("asignatura:color:actualizado", onColor);
    return () => window.removeEventListener("asignatura:color:actualizado", onColor);
  }, []);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="mb-4">Cursos</SidebarGroupLabel>
      <SidebarMenu>
        {snap.cursos.map((curso) => {
          const asignaturas = asignaturasPorCurso[curso.id] ?? [];
          const hasAsignaturas = asignaturas.length > 0;
          const open = openCursoId === curso.id;

          return (
            <SidebarMenuItem key={curso.id}>
              <div
                className="flex w-full items-center justify-between"
                onMouseLeave={() => {
                  setHoverLock(false);
                  closeAll();
                }}
              >
                <Popover
                  open={open}
                  onOpenChange={(v) => setOpenCursoId(v ? curso.id : null)}
                >
                  <PopoverTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      onMouseEnter={() => setOpenCursoId(curso.id)}
                      onFocus={() => setOpenCursoId(curso.id)}
                      className="-mt-2"
                    >
                      <Link href={`/cursos/${curso.id}`}>
                        <GraduationCap className="h-4 w-4 " />
                        <span className="truncate font-bold">
                          {curso.acronimo}
                          {curso.nivel ? ` ${curso.nivel}` : ""}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </PopoverTrigger>

                  <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="z-[80] w-80 rounded-lg border border-black/30 bg-zinc-800 p-3 shadow-popover-3d-ultra"
                    onMouseEnter={() => setHoverLock(true)}
                    onMouseLeave={() => {
                      setHoverLock(false);
                      setOpenCursoId(null);
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Lista de asignaturas */}
                      {hasAsignaturas ? (
                        asignaturas.map((asig) => {
                          const url = `/cursos/${curso.id}/asignaturas/${asig.id}`;
                          // 👉 color final: el que trae la asignatura o el del colorMap (con/sin ceros)
                          const bullet =
                            normalizeHex(asig.color) ||
                            colorMap[String(asig.id)] ||
                            colorMap[slim(String(asig.id))] ||
                            "#9ca3af";

                          return (
                            <div key={asig.id} className="flex flex-col gap-1">
                              <Link
                                href={url}
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setOpenCursoId(null)}
                              >
                                <span className="shrink-0">
                                 <Dot color={bullet} />
                                </span>
                                <BookA className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {asig.id} {asig.nombre}
                                </span>
                              </Link>
                              <Button
                                asChild
                                variant="secondary"
                                size="sm"
                                className="h-6 rounded-md px-2 text-[10px] leading-none"
                              >
                                <Link href={url} onClick={() => setOpenCursoId(null)}>
                                  <BookA className="mr-1 h-3 w-3" />
                                  Ver RA / CE
                                </Link>
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Este curso aún no tiene asignaturas.
                        </div>
                      )}

                      <Separator className="my-1" />

                      <Button asChild size="sm" className="rounded-md px-2.5 py-2 text-xs">
                        <Link
                          href={`/cursos/${curso.id}/actividades`}
                          className="inline-flex items-center gap-1"
                          onClick={() => setOpenCursoId(null)}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          Ver actividades
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-md px-2.5 py-2 text-xs"
                      >
                        <Link
                          href={`/cursos/${curso.id}/alumnos`}
                          className="inline-flex items-center gap-1"
                          onClick={() => setOpenCursoId(null)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Ver alumnos
                        </Link>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Acciones del curso */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <MoreHorizontal />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48 rounded-lg"
                    side={isMobile ? "bottom" : "right"}
                    align={isMobile ? "end" : "start"}
                  >
                    <DropdownMenuItem asChild>
                      <Link href={`/cursos/${curso.id}`}>
                        <Folder className="text-muted-foreground" />
                        <span>Ver curso</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        setCursoAEliminar({ id: curso.id, nombre: curso.acronimo })
                      }
                    >
                      <Trash2 className="text-red-500" />
                      <span className="text-red-500">Eliminar</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator className="my-3" />
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
