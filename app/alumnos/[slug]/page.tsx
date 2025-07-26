"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { Alumno } from "@/models/alumno"
import { crearSlugAlumno } from "@/lib/utils"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { UserIcon } from "lucide-react"

export default function AlumnoPage() {
  const params = useParams()
  const slug = params.slug as string
  const [alumno, setAlumno] = useState<Alumno | null>(null)

  useEffect(() => {
    const fetchAlumnos = async () => {
      const alumnos = await window.electronAPI.leerAlumnos()
      const encontrado = alumnos.find((a: Alumno) => crearSlugAlumno(a.nombre, a.apellidos) === slug)
      setAlumno(encontrado ?? null)
    }
    fetchAlumnos()
  }, [slug])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/alumnos">
                    <div className="inline-flex items-center gap-1">
                      <UserIcon className="w-4 h-4" />
                      Alumnos
                    </div>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>{slug}</BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* 📄 Contenido principal */}
        <div className="flex-1 p-6 text-white">
          {!alumno ? (
            <p className="text-white">Alumno no encontrado</p>
          ) : (
            <>
              <p className="text-3xl font-bold">{alumno.apellidos} / {alumno.nombre}</p>
              <p className="text-2xl font-bold mt-2">{alumno.curso}</p>
              <p><strong>Correo:</strong> {alumno.correo}</p>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
