"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center px-4 border-b border-border">
          {/* Aquí puedes poner un breadcrumb o título si quieres */}
        </header>
        <Separator />
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
