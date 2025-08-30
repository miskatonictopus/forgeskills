"use client"

import skillforge_black from "@/public/images/logo-white.png"
import skillforge_white from "@/public/images/logo-black.png"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import {
  ChartColumnBig,
  Settings,
  PlusCircle,
  CalendarDays,
  ListTodo,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
// import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad"

// Sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "PanelControl", url: "/", icon: ChartColumnBig, isActive: true },
    { title: "Configuración", url: "/configuracion", icon: Settings, isActive: true },
    { title: "Calendario", url: "/calendario", icon: CalendarDays, isActive: true },
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

  // ⬇️ Tema para alternar logo
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark = (theme ?? resolvedTheme) === "dark"

  const handleOpenNuevaActividad = () => {
    setFechaPreseleccionada(nowRounded30())
    setOpenNuevaActividad(true)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* 
          Nota: el usuario pidió "en tema LIGHT → skillforge_white".
          Por eso, cuando NO es dark, usamos `skillforge_white`.
          (Aunque los nombres de variables y ficheros estén cruzados en los imports.)
        */}
        {mounted ? (
          <img
            src={isDark ? skillforge_black.src : skillforge_white.src}
            alt="SkillForge"
            className="h-15 mx-auto transition-opacity duration-200"
          />
        ) : (
          // Evita FOUC de logo antes de montar
          <div className="h-15" />
        )}
        <p className="text-center text-zinc-400 text-xs">alpha version 1.0 // 2025 release 1.1</p>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />

        {/* Botón global: Crear actividad (debajo de Calendario) */}
        <div className="px-3 mt-2 space-y-2">
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={handleOpenNuevaActividad}
          >
            <PlusCircle className="w-4 h-4" />
            Crear actividad
          </Button>

          {/* Ver actividades (todas) */}
          <Button asChild variant="default" className="w-full justify-start gap-2">
            <Link href="/cursos/actividades/todas">
              <ListTodo className="w-4 h-4" />
              Ver actividades
            </Link>
          </Button>
        </div>

        <NavProjects />
      </SidebarContent>

      <SidebarFooter>{/* opcional: <NavUser /> */}</SidebarFooter>
      <SidebarRail />

      {/* Dialog en modo GLOBAL: sin curso/asignatura preseleccionados */}
      <DialogCrearActividad
        open={openNuevaActividad}
        onOpenChange={setOpenNuevaActividad}
        // fechaInicial={fechaPreseleccionada}
      />
    </Sidebar>
  )
}
