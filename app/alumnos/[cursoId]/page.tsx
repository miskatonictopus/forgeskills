"use client";
import React from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Mail, User } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

export default function AlumnosCursoPage() {
  const params = useParams();
  const cursoId = params.cursoId as string;

  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [alumnoExpandido, setAlumnoExpandido] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlumnos = async () => {
      const res = await window.electronAPI.leerAlumnosPorCurso(cursoId);
      setAlumnos(res);
    };

    fetchAlumnos();
  }, [cursoId]);

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
        <div className="flex items-center justify-between">
  <h1 className="text-3xl font-bold tracking-tight">
    <span className="uppercase">{cursoId}</span>
  </h1>
  <span className="flex items-center gap-1 text-muted-foreground text-sm font-light">
    <User className="w-4 h-4" />
    <span className="text-white">{alumnos.length}</span> alumno{alumnos.length !== 1 && "s"}
  </span>
</div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4 mr-1" />
                    Nombre
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </div>
                </TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alumnos.map((a) => (
                <React.Fragment key={a.id}>
                  <TableRow
                    onClick={() =>
                      setAlumnoExpandido((prev) =>
                        prev === a.id ? null : a.id
                      )
                    }
                    className="cursor-pointer hover:bg-muted transition"
                  >
                    <TableCell>
                      {a.apellidos}, {a.nombre}
                    </TableCell>
                    <TableCell>{a.mail}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground italic">
                        pendiente…
                      </span>
                    </TableCell>
                  </TableRow>

                  {alumnoExpandido === a.id && (
                    <TableRow className="bg-muted/50 animate-slide-fade-in">
                      <TableCell colSpan={3}>
                        <div className="p-4 text-sm text-muted-foreground animate-fade-in">
                          {/* Aquí irá el panel de datos del alumno */}
                          <p>
                            Panel de alumno{" "}
                            <strong>
                              {a.nombre} {a.apellidos}
                            </strong>
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
