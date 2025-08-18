import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/Dot"
import {
  Folder,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  BookOpen,
  ClipboardList, // 👈 nuevo
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

import { useEffect } from "react";
import Link from "next/link";

type Props = {
  setCursoAEliminar: (curso: { id: string; nombre: string }) => void;
};

function colorFromId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h} 80% 55%)`
}

export function NavCursos({ setCursoAEliminar }: Props) {
  const { isMobile } = useSidebar();
  const snap = useSnapshot(cursoStore);

  useEffect(() => {
    cursoStore.cargarCursos();
  }, []);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Cursos</SidebarGroupLabel>
      <SidebarMenu>
        {snap.cursos.map((curso) => {
          const tieneAsignaturas =
            (asignaturasPorCurso[curso.id]?.length ?? 0) > 0;

          return (
            <SidebarMenuItem key={curso.id}>
              <div className="flex flex-col w-full">
                {/* Curso principal */}
                <SidebarMenuButton asChild>
                  <Link href={`/cursos/${curso.id}`}>
                    <GraduationCap className="w-4 h-4" />
                    <span>{curso.acronimo}{curso.nivel}</span>
                  </Link>
                </SidebarMenuButton>

                {/* Lista + botón solo si hay asignaturas */}
                {tieneAsignaturas && (
                  <>
                   <ul className="ml-6 mt-1 space-y-1">
  {asignaturasPorCurso[curso.id].map((asig) => {
    const url = `/cursos/${curso.id}/asignaturas/${asig.id}`
    return (
      <li key={asig.id} className="space-y-1">
        {/* Link principal a RA/CE (el de siempre) */}
        <Link
          href={url}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <Dot color={asig.color ?? "#9ca3af"} />
          <BookOpen className="w-3 h-3" />
          <span className="truncate">{asig.id} {asig.nombre}</span>
        </Link>

        {/* Botón XS secundario al mismo link */}
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-6 px-2 text-[10px] leading-none rounded-md"
        >
          <Link href={url} className="inline-flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Ver RA / CE
          </Link>
        </Button>
      </li>
    )
  })}
</ul>

                    {/* Ver actividades */}
                    <div className="ml-6 mt-2">
                      <Button
                        asChild
                        size="sm"
                        className="px-2.5 py-2 mt-1 rounded-md bg-white text-black text-xs hover:bg-gray-100"
                      >
                        <Link
                          href={`/cursos/${curso.id}/actividades`}
                          className="inline-flex items-center gap-1"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          Ver actividades
                        </Link>
                      </Button>
                    </div>
                  </>
                )}

                <Separator className="my-3" />
              </div>

              {/* Dropdown acciones */}
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
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
