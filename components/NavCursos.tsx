import { useSnapshot } from "valtio"
import { cursoStore } from "@/store/cursoStore"
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso"
import {
  Folder,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  BookOpen,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import { useEffect } from "react"
import Link from "next/link"

type Props = {
  setCursoAEliminar: (curso: { id: string; nombre: string }) => void
}

export function NavCursos({ setCursoAEliminar }: Props) {
  const { isMobile } = useSidebar()
  const snap = useSnapshot(cursoStore)

  useEffect(() => {
    cursoStore.cargarCursos()
  }, [])

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Cursos</SidebarGroupLabel>
      <SidebarMenu>
        {snap.cursos.map((curso) => (
          <SidebarMenuItem key={curso.id}>
            <div className="flex flex-col w-full">
              {/* Curso principal */}
              <SidebarMenuButton asChild>
                <Link href={`/cursos/${curso.id}`}>
                  <GraduationCap className="w-4 h-4" />
                  <span>{curso.acronimo}{curso.nivel}</span>
                </Link>
              </SidebarMenuButton>

              {/* Lista de asignaturas */}
              {asignaturasPorCurso[curso.id]?.length > 0 && (
                <ul className="ml-6 mt-1 space-y-0.5">
                  {asignaturasPorCurso[curso.id].map((asig) => (
                    <li key={asig.id}>
                      <Link
                        href={`/cursos/${curso.id}/asignaturas/${asig.id}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span className="truncate">{asig.nombre}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Dropdown de acciones */}
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
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  <span>Ver curso</span>
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
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
