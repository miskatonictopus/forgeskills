"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSnapshot } from "valtio";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Mail, User, ExternalLink, Loader2 } from "lucide-react";

import { alumnosStore, cargarAlumnosCurso, type Alumno as StoreAlumno } from "@/store/alumnosStore";
import { cursoStore } from "@/store/cursoStore";
import { Dot } from "@/components/ui/Dot";

type UIAlumno = StoreAlumno & { mail?: string | null };

// helper visual de notas
function notaBadge(n?: number) {
  if (n == null || Number.isNaN(n)) return <Badge variant="outline">—</Badge>;
  const v = Number(n);
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  if (v < 5) variant = "destructive";
  else if (v < 7) variant = "secondary";
  else variant = "default";
  return <Badge variant={variant}>{v.toFixed(1)}</Badge>;
}

export default function AlumnosPorCursoPage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const router = useRouter();

  const snapAlumnos = useSnapshot(alumnosStore);
  const snapCursos = useSnapshot(cursoStore);

  const [search, setSearch] = useState("");
  const [loadingMedias, setLoadingMedias] = useState(true);
  const [colsAsignaturas, setColsAsignaturas] = useState<{ id: string; nombre: string; color: string }[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, Record<string, number>>>({});

  // carga base de alumnos (por si entras directo)
  useEffect(() => {
    if (cursoId) void cargarAlumnosCurso(cursoId);
  }, [cursoId]);

  // carga medias/columnas asignaturas
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!cursoId) return;
      setLoadingMedias(true);
      try {
        const res = await (window as any).electronAPI.obtenerMediasAlumnosCurso(cursoId);
        if (!mounted) return;
        setColsAsignaturas(res.asignaturas || []);
        setMediaMap(res.mediaMap || {});
      } catch (e) {
        console.error("obtenerMediasAlumnosCurso error", e);
      } finally {
        if (mounted) setLoadingMedias(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [cursoId]);

  const curso = useMemo(
    () => snapCursos.cursos?.find((c: any) => c.id === cursoId),
    [snapCursos.cursos, cursoId]
  );

  const alumnos: UIAlumno[] = useMemo(() => {
    const lista = (alumnosStore.porCurso[cursoId] ?? []) as UIAlumno[];
    if (!search.trim()) return lista;
    const q = search.toLowerCase();
    return lista.filter((a) =>
      `${a.apellidos ?? ""} ${a.nombre ?? ""} ${a.mail ?? ""}`.toLowerCase().includes(q)
    );
  }, [snapAlumnos.porCurso, cursoId, search]);

  const isLoadingBase = !!snapAlumnos.loading[cursoId];
  const isLoading = isLoadingBase || loadingMedias;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col gap-2 px-6 pt-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>Alumnos</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{curso?.acronimo || "Curso"}</BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {curso?.nombre ? `${curso.nombre} — Alumnos` : "Alumnos del curso"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Cargando…" : `${alumnos.length} alumno${alumnos.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar por nombre, apellidos o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72"
              />
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="px-6 pb-8">
          <div className="rounded-2xl border bg-card">
            <Table>
              <TableHeader className="text-xs">
                <TableRow>
                  <TableHead className="w-[26%]">Alumno</TableHead>
                  <TableHead className="w-[22%]">Email</TableHead>
                  {colsAsignaturas.map((asig) => (
                    <TableHead key={asig.id} className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Dot color={asig.color} />
                        <span className="truncate max-w-[180px]" title={asig.nombre}>
                          {asig.nombre}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[10%] text-center">Media global</TableHead>
                  <TableHead className="w-[10%] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3 + colsAsignaturas.length + 2} className="py-10 text-center text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando datos…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : alumnos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + colsAsignaturas.length + 2} className="py-10 text-center text-muted-foreground">
                      No hay alumnos para este curso{search ? " con ese criterio de búsqueda" : ""}.
                    </TableCell>
                  </TableRow>
                ) : (
                  alumnos.map((al) => {
                    const nombreCompleto = `${al.apellidos ?? ""} ${al.nombre ?? ""}`.trim();
                    const mediasAlumno = mediaMap[al.id] || {};

                    // media global: promedio de las asignaturas que tienen nota
                    const mediasNumeros = Object.values(mediasAlumno).filter(
                      (v) => typeof v === "number" && !Number.isNaN(v)
                    ) as number[];
                    const mediaGlobal =
                      mediasNumeros.length > 0
                        ? mediasNumeros.reduce((a, b) => a + b, 0) / mediasNumeros.length
                        : undefined;

                    return (
                      <TableRow key={String(al.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 opacity-70" />
                            <div className="font-medium">{nombreCompleto || "Sin nombre"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{al.mail || "—"}</TableCell>

                        {colsAsignaturas.map((asig) => (
                          <TableCell key={asig.id} className="text-center">
                            {notaBadge(mediasAlumno[asig.id])}
                          </TableCell>
                        ))}

                        <TableCell className="text-center">
                          {notaBadge(mediaGlobal)}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/alumnos/${al.id}`)}
                          >
                            Abrir ficha
                            <ExternalLink className="ml-1 h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
