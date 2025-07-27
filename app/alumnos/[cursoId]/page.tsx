"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

export default function AlumnosCursoPage() {
  const params = useParams()
  const cursoId = params.cursoId as string

  const [alumnos, setAlumnos] = useState<any[]>([])

  useEffect(() => {
    const fetchAlumnos = async () => {
      const res = await window.electronAPI.leerAlumnosPorCurso(cursoId)
      setAlumnos(res)
    }

    fetchAlumnos()
  }, [cursoId])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header con breadcrumb */}
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/alumnos">Alumnos</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/alumnos/${cursoId}`}>
                    Curso {cursoId}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">
            Alumnos del curso: <span className="uppercase">{cursoId}</span>
          </h1>

          <ul className="space-y-2">
            {alumnos.map((a) => (
              <li key={a.id} className="text-white">
                {a.apellidos}, {a.nombre} — {a.mail}
              </li>
            ))}
          </ul>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
