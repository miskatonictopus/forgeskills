// app-sidebar.tsx
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { ChartColumnBig, Settings, PlusCircle, CalendarDays, ListTodo } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

// ⬇️ Reemplaza el antiguo DialogCrearActividad por el selector nuevo
import DialogSelectorActividad from "@/components/DialogSelectorActividad"
// ⬇️ Tus dos diálogos concretos (pon las rutas donde los tengas)
import DialogCrearActividadManual from "@/components/actividades/DialogCrearActividadManual";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad"

// ── LOGOS ──────────────────────────────────────────────
import logoLight from "@/public/images/logo-black.png"
import logoDark from "@/public/images/logo-white.png"
import markLight from "@/public/images/mark-black.png"
import markDark from "@/public/images/mark-white.png"
// ──────────────────────────────────────────────────────

const data = {
  navMain: [
    { title: "PanelControl",   url: "/dashboard",   icon: ChartColumnBig, isActive: true },
    { title: "Configuración",  url: "/configuracion", icon: Settings },
    { title: "Calendario",     url: "/calendario",  icon: CalendarDays },
  ],
}

// helper: redondeado a 30'
function nowRounded30() {
  const d = new Date()
  const minutes = d.getMinutes()
  const rounded = Math.ceil(minutes / 30) * 30
  d.setMinutes(rounded % 60, 0, 0)
  if (rounded >= 60) d.setHours(d.getHours() + 1)
  return d
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  // Estado del selector inicial
  const [openSelector, setOpenSelector] = React.useState(false)
  // Estados de cada flujo
  const [openManual, setOpenManual] = React.useState(false)
  const [openLLM, setOpenLLM] = React.useState(false)

  // Si quieres pasar una fecha preseleccionada a los flujos
  const [fechaPreseleccionada, setFechaPreseleccionada] = React.useState<Date | undefined>(undefined)

  // Tema para alternar logo
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark = (theme ?? resolvedTheme) === "dark"

  const handleOpenNuevaActividad = () => {
    setFechaPreseleccionada(nowRounded30())
    setOpenSelector(true) // ← ahora abrimos el selector, no un único diálogo
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-3">
        <div className="flex h-12 items-center gap-2 mt-2">
          {mounted && (
            <div className="w-auto flex justify-center group-data-[collapsible=icon]:hidden ml-[auto] mr-[auto]">
              <Image
                src={isDark ? logoDark : logoLight}
                alt="ForgeSkills"
                priority
                className="block h-14 w-auto group-data-[collapsible=icon]:hidden"
              />
            </div>
          )}
          {mounted && (
            <Image
              src={isDark ? markDark : markLight}
              alt="FS"
              priority
              className="hidden h-6 w-6 shrink-0 rounded-md group-data-[collapsible=icon]:block"
            />
          )}
        </div>

        <p className="text-center text-zinc-400 text-xs group-data-[collapsible=icon]:hidden">
          alpha version 1.0 // 2025 release 1.1
        </p>
      </SidebarHeader>

      <SidebarContent>
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

      <SidebarFooter>{/* NavUser si lo usas */}</SidebarFooter>
      <SidebarRail />

      {/* 1) Selector de modo */}
      <DialogSelectorActividad
        open={openSelector}
        onOpenChange={setOpenSelector}
        onSelect={(mode) => {
          if (mode === "manual") setOpenManual(true)
          if (mode === "llm") setOpenLLM(true)
        }}
        // disableLLM // ← descomenta si aún no quieres habilitar el flujo LLM
      />

      {/* 2) Diálogo Manual */}
      <DialogCrearActividadManual
        open={openManual}
        onOpenChange={setOpenManual}
        // fechaInicial={fechaPreseleccionada}
      />

      {/* 3) Diálogo LLM */}
      <DialogCrearActividad
        open={openLLM}
        onOpenChange={setOpenLLM}
        // fechaInicial={fechaPreseleccionada}
      />
    </Sidebar>
  )
}
