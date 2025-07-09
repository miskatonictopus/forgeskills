"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

type Curso = {
  id: string
  acronimo: string
  nombre: string
  nivel: string
  grado: string
  clase: string
}

export default function Page() {
  const [cursos, setCursos] = useState<Curso[]>([])

  useEffect(() => {
    const fetchCursos = async () => {
      try {
        const cursosBD = await window.electronAPI.leerCursos?.()
        setCursos(cursosBD || [])
        console.log("📘 Cursos en BDD:", cursosBD)
      } catch (error) {
        console.error("❌ Error al leer cursos:", error)
        toast.error("No se pudieron cargar los cursos")
      }
    }

    fetchCursos()
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Panel de Control</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* 🔲 Tarjetas de cursos */}
          <div className="flex flex-wrap gap-2">
            {cursos.length === 0 ? (
              <>
                <div className="w-32 aspect-square rounded-xl bg-muted/50" />
                <div className="w-32 aspect-square rounded-xl bg-muted/50" />
                <div className="w-32 aspect-square rounded-xl bg-muted/50" />
              </>
            ) : (
              cursos.map((curso) => (
                <Card
                  key={curso.id}
                  className="w-auto min-w-[10rem] max-w-[16rem] bg-zinc-900 border border-zinc-700 text-white"
                >
                  <CardContent className="leading-tight space-y-1">
                  <p className="text-xl font-bold truncate uppercase">
                      {curso.acronimo}{curso.nivel}</p>
                    <p className="text-xs font-light text-zinc-400 uppercase">{curso.nombre}</p>
                    {/* <p><strong>Nivel:</strong> {curso.nivel}</p> */}
                    <p><span className="text-xs font-light text-zinc-400">Grado:</span><span className="text-xs font-light text-white uppercase">{curso.grado}</span></p>
                    <p><span className="text-xs font-light text-zinc-400">Clase:</span><span className="text-xs font-light text-white uppercase">{curso.clase}</span></p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Otra sección inferior, si quieres dejarla */}
          <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
