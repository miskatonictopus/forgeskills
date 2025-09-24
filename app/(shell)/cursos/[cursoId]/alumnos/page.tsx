"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnapshot } from "valtio";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, ExternalLink, Loader2 } from "lucide-react";

import {
  alumnosStore,
  cargarAlumnosCurso,
  type Alumno as StoreAlumno,
} from "@/store/alumnosStore";
import { cursoStore } from "@/store/cursoStore";
import { Dot } from "@/components/ui/Dot";

type UIAlumno = StoreAlumno & { mail?: string | null };

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
  const [colsAsignaturas, setColsAsignaturas] = useState<
    { id: string; nombre: string; color: string }[]
  >([]);
  const [mediaMap, setMediaMap] = useState<
    Record<string, Record<string, number>>
  >({});

  // 1) Cargar alumnos del curso
  useEffect(() => {
    if (!cursoId) return;
    void cargarAlumnosCurso(cursoId);
  }, [cursoId]);

  // 2) Cargar medias por alumno/asignatura
  useEffect(() => {
    if (!cursoId) return;
    let mounted = true;
    (async () => {
      setLoadingMedias(true);
      try {
        const res =
          (await (window as any)?.electronAPI?.obtenerMediasAlumnosCurso?.(
            cursoId
          )) ?? {};
        if (!mounted) return;
        setColsAsignaturas(res.asignaturas ?? []);
        setMediaMap(res.mediaMap ?? {});
      } catch (e) {
        console.error("obtenerMediasAlumnosCurso error", e);
        if (mounted) {
          setColsAsignaturas([]);
          setMediaMap({});
        }
      } finally {
        if (mounted) setLoadingMedias(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cursoId]);

  const curso = useMemo(
    () => snapCursos.cursos?.find((c: any) => c.id === cursoId),
    [snapCursos.cursos, cursoId]
  );

  // 3) Filtro de alumnos
  const alumnos: UIAlumno[] = useMemo(() => {
    const lista = (alumnosStore.porCurso[cursoId] ?? []) as UIAlumno[];
    if (!search.trim()) return lista;
    const q = search.toLowerCase();
    return lista.filter((a) =>
      `${a.apellidos ?? ""} ${a.nombre ?? ""} ${a.mail ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [snapAlumnos.porCurso, cursoId, search]);

  // 4) Ranking (Top / Last)
  type RankingItem = { id: string; nombre: string; media: number };
  const rankingItems: RankingItem[] = useMemo(() => {
    const todos = (alumnosStore.porCurso[cursoId] ?? []) as UIAlumno[];
    return todos.map((al) => {
      const mediasAlumno = mediaMap[al.id] || {};
      const nums = Object.values(mediasAlumno).filter(
        (v) => typeof v === "number" && !Number.isNaN(v)
      ) as number[];
      const media =
        nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
      const nombre = `${al.apellidos ?? ""} ${al.nombre ?? ""}`.trim() || "Sin nombre";
      return { id: String(al.id), nombre, media };
    });
  }, [snapAlumnos.porCurso, mediaMap, cursoId]);

  const isLoadingBase = !!snapAlumnos.loading[cursoId];
  const isLoading = isLoadingBase || loadingMedias;

  function onAbrirAlumno(a: { id: string }) {
    router.push(`/alumnos/${a.id}`);
  }

  return (
    <main>
      <div className="p-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {curso?.nombre ? `${curso.nombre} — Alumnos` : "Alumnos del curso"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Cargando…"
                : `${alumnos.length} alumno${alumnos.length === 1 ? "" : "s"}`}
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

        <div className="px-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 3</CardTitle>
                <CardDescription>Basado en medias globales por asignatura</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rankingItems
                  .slice()
                  .sort((a, b) => (isNaN(b.media) ? -1 : b.media - a.media))
                  .slice(0, 3)
                  .map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <div className="truncate font-bold text-xs">
                        <div className="flex items-center">
                          <User className="h-6 w-6 opacity-70 pr-2 text-emerald-400" />
                          {it.nombre}
                        </div>
                      </div>
                      <Button className="text-xs" size="sm" onClick={() => onAbrirAlumno(it)}>
                        Abrir
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last 3</CardTitle>
                <CardDescription>Alumnos con peores medias</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rankingItems
                  .slice()
                  .sort((a, b) => (isNaN(a.media) ? 1 : a.media - b.media))
                  .slice(0, 3)
                  .map((it) => (
                    <div key={it.id} className="flex items-center justify-between">
                      <div className="truncate font-bold text-xs">
                        <div className="flex items-center">
                          <User className="h-6 w-6 opacity-70 pr-2 text-orange-400" />
                          {it.nombre}
                        </div>
                      </div>
                      <Button
                        className="text-xs"
                        variant="secondary"
                        size="sm"
                        onClick={() => onAbrirAlumno(it)}
                      >
                        Abrir
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
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
                    <TableCell
                      colSpan={3 + colsAsignaturas.length + 2}
                      className="py-10 text-center text-muted-foreground"
                    >
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando datos…
                      </div>
                    </TableCell>
                  </TableRow>
                ) : alumnos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3 + colsAsignaturas.length + 2}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No hay alumnos para este curso
                      {search ? " con ese criterio de búsqueda" : ""}.
                    </TableCell>
                  </TableRow>
                ) : (
                  alumnos.map((al) => {
                    const nombreCompleto =
                      `${al.apellidos ?? ""} ${al.nombre ?? ""}`.trim();
                    const mediasAlumno = mediaMap[al.id] || {};
                    const mediasNumeros = Object.values(mediasAlumno).filter(
                      (v) => typeof v === "number" && !Number.isNaN(v)
                    ) as number[];
                    const mediaGlobal =
                      mediasNumeros.length > 0
                        ? mediasNumeros.reduce((a, b) => a + b, 0) / mediasNumeros.length
                        : undefined;

                    return (
                      <TableRow key={String(al.id)}>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 opacity-70" />
                            <div className="font-medium">
                              {nombreCompleto || "Sin nombre"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{al.mail || "—"}</TableCell>

                        {colsAsignaturas.map((asig) => (
                          <TableCell key={asig.id} className="text-center text-xs">
                            {notaBadge(mediasAlumno[asig.id])}
                          </TableCell>
                        ))}

                        <TableCell className="text-center text-xs">
                          {notaBadge(mediaGlobal)}
                        </TableCell>

                        <TableCell className="text-right text-xs">
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
      </div>
    </main>
  );
}
