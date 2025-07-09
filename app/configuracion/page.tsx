"use client"

import { useState, useEffect } from "react"
import { PlusCircle } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NuevoCurso } from "@/components/NuevoCurso"

export default function ConfiguracionPage() {
  const [open, setOpen] = useState(false)

  // ✅ Escucha el evento de cierre del modal
  useEffect(() => {
    const handleClose = () => setOpen(false)
    document.addEventListener("cerrar-curso-modal", handleClose)
    return () => document.removeEventListener("cerrar-curso-modal", handleClose)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header fijo */}
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
                  <BreadcrumbLink href="#">Configuración</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Configuración</h1>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nuevo Curso
                </Button>
              </DialogTrigger>

              {/* Aquí sí envolvemos correctamente el contenido del modal */}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Curso</DialogTitle>
                </DialogHeader>
                <NuevoCurso />
              </DialogContent>
            </Dialog>
          </div>

          {/* Aquí puedes añadir más contenido relacionado con configuración */}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
