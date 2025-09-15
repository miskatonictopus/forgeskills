"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Mail, User } from "lucide-react";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { alumnosStore, cargarAlumnosCurso, getAlumnosDeCurso } from "@/store/alumnosStore";

type Alumno = { id: string; nombre: string; apellidos: string; mail?: string };

export default function AlumnosCursoPage() {
  const { cursoId } = useParams<{ cursoId: string }>();
  const [alumnoExpandido, setAlumnoExpandido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // snapshot light: sólo lo necesario
  const alumnos: Alumno[] = useMemo(() => getAlumnosDeCurso(String(cursoId)), [cursoId]);
  const loading = alumnosStore.loading[String(cursoId)] ?? false;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        await cargarAlumnosCurso(String(cursoId));
        // mantener expandido si aún existe
        if (alive && alumnoExpandido && !getAlumnosDeCurso(String(cursoId)).some(a => a.id === alumnoExpandido)) {
          setAlumnoExpandido(null);
        }
      } catch (e: any) {
        console.error("[AlumnosCursoPage] cargarAlumnosCurso:", e);
        if (alive) setError("No se pudieron cargar los alumnos.");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId]);

  const plural = new Intl.PluralRules("es").select(alumnos.length);
  const sufijo = plural === "one" ? "" : "s";

  return (
    <main>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="uppercase">{String(cursoId)}</span>
          </h1>
          <span className="flex items-center gap-1 text-muted-foreground text-sm font-light">
            <User className="w-4 h-4" />
            <span className="text-foreground">{alumnos.length}</span> alumno{sufijo}
          </span>
        </div>

        {/* Estados */}
        {loading && (
          <div className="text-sm text-muted-foreground italic">Cargando alumnos…</div>
        )}
        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}
        {!loading && !error && alumnos.length === 0 && (
          <div className="text-sm text-muted-foreground">No hay alumnos en este curso.</div>
        )}

        {/* Tabla */}
        {alumnos.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">
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
                    onClick={() => setAlumnoExpandido(prev => (prev === a.id ? null : a.id))}
                    className="cursor-pointer hover:bg-muted/60 transition-colors"
                  >
                    <TableCell>{a.apellidos}, {a.nombre}</TableCell>
                    <TableCell>{a.mail ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground italic">pendiente…</span>
                    </TableCell>
                  </TableRow>

                  {alumnoExpandido === a.id && (
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3}>
                        <div className="p-4 text-sm text-muted-foreground">
                          Panel de alumno <strong>{a.nombre} {a.apellidos}</strong>
                          {/* aquí podrás cargar notas, actividades, etc. */}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}
