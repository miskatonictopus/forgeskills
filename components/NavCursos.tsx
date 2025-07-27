"use client"

import { useSnapshot } from "valtio"
import { cursoStore } from "@/store/cursoStore"
import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  GraduationCap,
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
              <SidebarMenuButton asChild>
                <a href={`/cursos/${curso.id}`}>
                  <GraduationCap className="w-4 h-4" />
                  <span>{curso.acronimo}</span>
                </a>
              </SidebarMenuButton>
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
  onClick={() => {
    console.log("🧨 CLICK EN ELIMINAR", curso.id, curso.acronimo)
    setCursoAEliminar({ id: curso.id, nombre: curso.acronimo })
  }}
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