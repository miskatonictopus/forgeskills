"use client"

import skillforge_black from "@/public/images/logo-white.png"

import * as React from "react"
import {
  ChartColumnBig,
  Settings,
  PlusCircle,
  CalendarDays, // 👈 nuevo
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"             // 👈 nuevo
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad" // 👈 nuevo

// Sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "PanelControl",
      url: "/",
      icon: ChartColumnBig,
      isActive: true,
    },
    {
      title: "Configuración",
      url: "/configuracion",
      icon: Settings,
      isActive: true,
    },
    {
      title: "Calendario",
      url: "/calendario",
      icon: CalendarDays,
      isActive: true,
    },
  ],
}

// helper: ahora redondeado a 30'
function nowRounded30() {
  const d = new Date()
  const minutes = d.getMinutes()
  const rounded = Math.ceil(minutes / 30) * 30
  d.setMinutes(rounded % 60, 0, 0)
  if (rounded >= 60) d.setHours(d.getHours() + 1)
  return d
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [openNuevaActividad, setOpenNuevaActividad] = React.useState(false)
  const [fechaPreseleccionada, setFechaPreseleccionada] = React.useState<Date | undefined>(undefined)

  const handleOpenNuevaActividad = () => {
    setFechaPreseleccionada(nowRounded30())
    setOpenNuevaActividad(true)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <img
          src={skillforge_black.src}
          alt="SkillForge"
          className="h-8 mx-auto"
        />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />

        {/* Botón global: Crear actividad (debajo de Calendario) */}
        <div className="px-3 mt-2">
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={handleOpenNuevaActividad}
          >
            <PlusCircle className="w-4 h-4" />
            Crear actividad
          </Button>
        </div>

        <NavProjects />
      </SidebarContent>

      <SidebarFooter>{/* puedes dejarlo vacío o añadir <NavUser /> */}</SidebarFooter>
      <SidebarRail />

      {/* Dialog en modo GLOBAL: sin curso/asignatura preseleccionados */}
      <DialogCrearActividad
        open={openNuevaActividad}
        onOpenChange={setOpenNuevaActividad}
        // fechaInicial={fechaPreseleccionada}
        // al ser global NO pasamos cursoId/asignaturaId -> el diálogo mostrará los selects
      />
    </Sidebar>
  )
}
