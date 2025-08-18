"use client"

import skillforge_black from "@/public/images/logo-white.png"

import * as React from "react"
import {
  ChartColumnBig,
  Settings,
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
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

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },

  navMain: [
    {title: "PanelControl",
      url: "/",
      icon: ChartColumnBig,
      isActive: true,
    },
    {title: "Configuración",
      url: "/configuracion",
      icon: Settings,
      isActive: true,
    },
    {title: "Calendario",
      url: "/calendario",
      icon: Settings,
      isActive: true,
    },
  ],
  
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavProjects/>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
