"use client";
import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";
import { CursoCard } from "@/components/CursoCard";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { GraduationCap, BookA, User, Pencil } from "lucide-react";

export default function Page() {
  const snap = useSnapshot(cursoStore);
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-16 items-center gap-2 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 mx-2" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Panel de Control</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* LAYOUT 2x2 */}
        <main className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 pl-4 pr-4 pt-1 pb-4 h-[calc(100vh-4rem)] overflow-y-auto">
          {/* MIS CURSOS */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
  <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
    <GraduationCap className="w-5 h-5" />
    Mis Cursos
  </h2>

  {/* Contenedor scrollable */}
  <div className="flex-1 overflow-y-auto pr-1">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {snap.cursos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cursos disponibles.</p>
      ) : (
        snap.cursos.map((curso) => (
          <CursoCard key={curso.id} curso={curso} />
        ))
      )}
    </div>
  </div>
</section>

          {/* MIS ASIGNATURAS */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookA className="w-5 h-5" />
              Mis Asignaturas
            </h2>
            <div className="flex-1 rounded bg-background/60" />
          </section>

          {/* MIS ALUMNOS */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              Mis Alumnos
            </h2>
            <div className="flex-1 rounded bg-background/60" />
          </section>

          {/* MIS ACTIVIDADES */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Mis Actividades
            </h2>
            <div className="flex-1 rounded bg-background/60" />
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
