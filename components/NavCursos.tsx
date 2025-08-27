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

export function NavCursos({ setCursoAEliminar }: Props) {
  const { isMobile } = useSidebar();
  const snap = useSnapshot(cursoStore);

  // Control del popover abierto
  const [openCursoId, setOpenCursoId] = useState<string | null>(null);
  const [hoverLock, setHoverLock] = useState(false); // evita cierre al cruzar trigger↔content

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
                  {/* Trigger: click navega al curso; hover abre el popover */}
                  <PopoverTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      onMouseEnter={() => setOpenCursoId(curso.id)}
                      onFocus={() => setOpenCursoId(curso.id)}
                    >
                      <Link href={`/cursos/${curso.id}`}>
                        <GraduationCap className="h-4 w-4" />
                        <span className="truncate">
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
                    className="z-[80] w-80 rounded-lg border border-black/30 bg-popover p-3 shadow-popover-3d-ultra"
                    onMouseEnter={() => setHoverLock(true)}
                    onMouseLeave={() => {
                      setHoverLock(false);
                      setOpenCursoId(null);
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Lista de asignaturas (si hay) */}
                      {hasAsignaturas ? (
                        asignaturas.map((asig) => {
                          const url = `/cursos/${curso.id}/asignaturas/${asig.id}`;
                          return (
                            <div key={asig.id} className="flex flex-col gap-1">
                              <Link
                                href={url}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                                onClick={() => setOpenCursoId(null)}
                              >
                                <Dot color={asig.color ?? "#9ca3af"} />
                                <BookOpen className="h-4 w-4" />
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
                                  <BookOpen className="mr-1 h-3 w-3" />
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

                      {/* Ver actividades */}
                      <Button
                        asChild
                        size="sm"
                        className="rounded-md px-2.5 py-2 text-xs"
                      >
                        <Link
                          href={`/cursos/${curso.id}/actividades`}
                          className="inline-flex items-center gap-1"
                          onClick={() => setOpenCursoId(null)}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          Ver actividades
                        </Link>
                      </Button>

                      {/* Ver alumnos (nuevo) */}
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
