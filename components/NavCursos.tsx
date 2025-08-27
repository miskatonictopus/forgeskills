"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/Dot";
import {
  Folder,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  BookOpen,
  ClipboardList,
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

// ✅ usa el wrapper de shadcn (internamente Radix)
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

type Props = {
  setCursoAEliminar: (curso: { id: string; nombre: string }) => void;
};

export function NavCursos({ setCursoAEliminar }: Props) {
  const { isMobile } = useSidebar();
  const snap = useSnapshot(cursoStore);

  // Controla qué curso tiene el popover abierto
  const [openCursoId, setOpenCursoId] = useState<string | null>(null);
  const [hoverLock, setHoverLock] = useState(false); // evita cerrar al pasar del trigger al content
  const closeAll = () => !hoverLock && setOpenCursoId(null);

  useEffect(() => {
    cursoStore.cargarCursos();
  }, []);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Cursos</SidebarGroupLabel>
      <SidebarMenu>
        {snap.cursos.map((curso) => {
          const asignaturas = asignaturasPorCurso[curso.id] ?? [];
          const hasAsignaturas = asignaturas.length > 0;
          const open = openCursoId === curso.id;

          return (
            <SidebarMenuItem key={curso.id}>
              <div
                className="flex items-center justify-between w-full"
                onMouseLeave={() => {
                  setHoverLock(false);
                  closeAll();
                }}
              >
                <Popover
                  open={open}
                  onOpenChange={(v) => setOpenCursoId(v ? curso.id : null)}
                >
                  {/* Trigger: navega al curso; hover abre popover */}
                  <PopoverTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      onMouseEnter={() => {
                        if (hasAsignaturas) setOpenCursoId(curso.id);
                      }}
                      onFocus={() => {
                        if (hasAsignaturas) setOpenCursoId(curso.id);
                      }}
                    >
                      <Link href={`/cursos/${curso.id}`}>
                        <GraduationCap className="w-4 h-4" />
                        <span>
                          {curso.acronimo}
                          {curso.nivel}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </PopoverTrigger>

                  {hasAsignaturas && (
                    <PopoverContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="z-[60] w-80 p-3 rounded-lg bg-popover shadow-popover-3d-strong border border-black/20"
                      onMouseEnter={() => setHoverLock(true)}
                      onMouseLeave={() => {
                        setHoverLock(false);
                        setOpenCursoId(null);
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        {asignaturas.map((asig) => {
                          const url = `/cursos/${curso.id}/asignaturas/${asig.id}`;
                          return (
                            <div key={asig.id} className="flex flex-col gap-1">
                              <Link
                                href={url}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                                onClick={() => setOpenCursoId(null)}
                              >
                                <Dot color={asig.color ?? "#9ca3af"} />
                                <BookOpen className="w-4 h-4" />
                                <span className="truncate">
                                  {asig.id} {asig.nombre}
                                </span>
                              </Link>
                              <Button
                                asChild
                                variant="secondary"
                                size="sm"
                                className="h-6 px-2 text-[10px] leading-none rounded-md"
                              >
                                <Link href={url} onClick={() => setOpenCursoId(null)}>
                                  <BookOpen className="w-3 h-3 mr-1" />
                                  Ver RA / CE
                                </Link>
                              </Button>
                            </div>
                          );
                        })}

                        <Separator className="my-1" />

                        <Button
                          asChild
                          size="sm"
                          className="px-2.5 py-2 rounded-md bg-white text-black text-xs hover:bg-gray-100"
                        >
                          <Link
                            href={`/cursos/${curso.id}/actividades`}
                            className="inline-flex items-center gap-1"
                            onClick={() => setOpenCursoId(null)}
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Ver actividades
                          </Link>
                        </Button>
                      </div>
                    </PopoverContent>
                  )}
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
