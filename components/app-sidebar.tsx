"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { ChartColumnBig, Settings, PlusCircle, CalendarDays, ListTodo } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { TeamSwitcher } from "@/components/team-switcher" // si lo usas
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad"

// ── IMPORTA TUS LOGOS ──────────────────────────────────────────────
// Horizontal (ancho)
import logoLight from "@/public/images/logo-black.png"  // para tema LIGHT
import logoDark from "@/public/images/logo-white.png"   // para tema DARK
// Mark (cuadrado). Si no los tienes aún, puedes apuntar a los mismos.
import markLight from "@/public/images/mark-black.png"
import markDark from "@/public/images/mark-white.png"
// ───────────────────────────────────────────────────────────────────

const data = {
  navMain: [
    { title: "PanelControl",   url: "/dashboard",   icon: ChartColumnBig, isActive: true },
    { title: "Configuración",  url: "/configuracion", icon: Settings },
    { title: "Calendario",     url: "/calendario",  icon: CalendarDays },
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

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [openNuevaActividad, setOpenNuevaActividad] = React.useState(false)
  const [fechaPreseleccionada, setFechaPreseleccionada] = React.useState<Date | undefined>(undefined)

  // Tema para alternar logo
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark = (theme ?? resolvedTheme) === "dark"

  const handleOpenNuevaActividad = () => {
    setFechaPreseleccionada(nowRounded30())
    setOpenNuevaActividad(true)
  }

  return (
    // ⬇️ clave para tener data-attrs de colapso
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3">
        <div className="flex h-12 items-center gap-2">
          {/* Logo horizontal (visible cuando NO está colapsado) */}
          {mounted && (
            <Image
              src={isDark ? logoDark : logoLight}
              alt="ForgeSkills"
              priority
              className="block h-15 w-auto group-data-[collapsible=icon]:hidden"
            />
          )}
          {/* Logomark cuadrado (visible en colapsado) */}
          {mounted && (
            <Image
              src={isDark ? markDark : markLight}
              alt="FS"
              priority
              className="hidden h-6 w-6 shrink-0 rounded-md group-data-[collapsible=icon]:block"
            />
          )}
        </div>

        {/* Texto de versión: oculto en colapsado */}
        <p className="text-center text-zinc-400 text-xs group-data-[collapsible=icon]:hidden">
          alpha version 1.0 // 2025 release 1.1
        </p>
      </SidebarHeader>

      <SidebarContent>
        {/* Si usas selector de equipo, ponlo aquí
        <div className="px-3 pb-2 group-data-[collapsible=icon]:hidden">
          <TeamSwitcher />
        </div>
        */}

        <NavMain items={data.navMain} />

        {/* Acciones rápidas */}
        <div className="px-3 mt-2 space-y-2">
          <Button
            variant="default"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
            onClick={handleOpenNuevaActividad}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Crear actividad</span>
          </Button>

          <Button
            asChild
            variant="default"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <Link href="/cursos/actividades/todas">
              <ListTodo className="w-4 h-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Ver actividades</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="default"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <Link href="/programacion">
              <ListTodo className="w-4 h-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Programación Didáctica</span>
            </Link>
          </Button>
        </div>

        <NavProjects />
      </SidebarContent>

      <SidebarFooter>
        {/* Aquí tu NavUser si lo tienes; oculta el nombre en colapsado si quieres */}
      </SidebarFooter>

      <SidebarRail />

      {/* Dialog global (sin curso/asignatura preseleccionados) */}
      <DialogCrearActividad
        open={openNuevaActividad}
        onOpenChange={setOpenNuevaActividad}
        // fechaInicial={fechaPreseleccionada}
      />
    </Sidebar>
  )
}
