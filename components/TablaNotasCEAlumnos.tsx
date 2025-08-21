"use client";

import React, { useMemo } from "react";

type Alumno = { id: string; nombre: string; apellidos: string };
type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

type NotaDetallada = {
  alumno_id: string;
  ce_codigo: string;
  actividad_id: string;
  actividad_fecha?: string | null;
  actividad_nombre?: string | null;
  nota: number | null;
};

type Props = {
  alumnos: Alumno[];
  ra: RA[];
  notasDetalle: NotaDetallada[]; // 👈 una fila por actividad
};

const normCE = (s: string) => String(s ?? "").trim().toUpperCase();

function getNotaColor(nota: number | null) {
  if (nota === null || isNaN(nota)) return "text-muted-foreground";
  if (nota < 5) return "text-red-600 dark:text-red-400";
  if (nota < 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export default function TablaNotasCEAlumnos({ alumnos, ra, notasDetalle = [] }: Props) {
  // Index: (alumnoId|CE) -> array de notas por actividad (ordenadas por fecha)
  const idx = useMemo(() => {
    const m = new Map<string, NotaDetallada[]>();
    for (const n of notasDetalle) {
      const key = `${n.alumno_id}::${normCE(n.ce_codigo)}`;
      const arr = m.get(key) ?? [];
      arr.push(n);
      m.set(key, arr);
    }
    // ordenar por fecha asc (las sin fecha al final)
    for (const [k, arr] of m) {
      arr.sort((a, b) => {
        const ta = a.actividad_fecha ? Date.parse(a.actividad_fecha) : Number.MAX_SAFE_INTEGER;
        const tb = b.actividad_fecha ? Date.parse(b.actividad_fecha) : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
      m.set(k, arr);
    }
    return m;
  }, [notasDetalle]);

  // Dedupe CE por RA (por si vinieran repetidos)
  const raDedup = useMemo(() => {
    return ra.map((raItem) => {
      const seen = new Set<string>();
      const CEunicos: CE[] = [];
      for (const ce of raItem.CE || []) {
        const code = normCE(ce.codigo);
        if (code && !seen.has(code)) {
          seen.add(code);
          CEunicos.push({ codigo: code, descripcion: ce.descripcion });
        }
      }
      return { ...raItem, CE: CEunicos, codigo: String(raItem.codigo).trim() };
    });
  }, [ra]);

  const notasDe = (alumnoId: string, ceCodigo: string) =>
    idx.get(`${alumnoId}::${normCE(ceCodigo)}`) ?? [];

  return (
    <div className="space-y-4">
      <div className="overflow-auto max-h-[75vh] border rounded-xl shadow">
        <table className="min-w-max table-auto text-sm">
          <thead className="bg-muted/50">
            <tr className="sticky top-0 z-10 bg-muted border-b border-muted">
              <th className="sticky text-xs left-0 bg-muted px-4 py-2 font-bold text-left border-r border-muted">
                CE / RA / Alumno
              </th>
              {alumnos.map((a, i) => (
                <th
                  key={`hdr-${a.id}`}
                  className={`px-4 py-2 font-medium text-xs text-left whitespace-nowrap ${
                    i !== 0 ? "border-l border-white/10" : ""
                  }`}
                >
                  {a.apellidos}, {a.nombre}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {raDedup.map((raItem) => (
              <React.Fragment key={`RA-${raItem.codigo}`}>
                {/* Encabezado del RA */}
                <tr className="bg-muted/10 border-t">
                  <td
                    colSpan={alumnos.length + 1}
                    className="sticky left-0 bg-background font-semibold px-4 py-2 border-r border-muted whitespace-normal break-words"
                  >
                    {raItem.codigo} – {raItem.descripcion}
                  </td>
                </tr>

                {/* Filas de CE */}
                {raItem.CE.map((ce) => (
                  <tr key={`row-${raItem.codigo}-${ce.codigo}`} className="border-t">
                    <td className="sticky left-0 bg-background px-4 py-2 text-muted-foreground text-xs border-r border-muted w-72 whitespace-normal break-words">
                      {ce.codigo} – {ce.descripcion}
                    </td>

                    {alumnos.map((alumno, index) => {
                      const arr = notasDe(alumno.id, ce.codigo);
                      return (
                        <td
                          key={`cell-${alumno.id}-${ce.codigo}`}
                          className={`px-2 py-1 align-top ${
                            index !== 0 ? "border-l border-white/10" : ""
                          }`}
                        >
                          {arr.length === 0 ? (
                            <div className="w-10 text-sm text-center text-muted-foreground">-</div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {arr.map((n) => {
                                const fecha =
                                  n.actividad_fecha &&
                                  !isNaN(Date.parse(n.actividad_fecha))
                                    ? new Date(n.actividad_fecha).toLocaleDateString("es-ES")
                                    : "";
                                const titulo = n.actividad_nombre || "";
                                return (
                                  <span
                                    key={`pill-${n.actividad_id}-${alumno.id}-${ce.codigo}`}
                                    title={titulo ? `${titulo}${fecha ? ` · ${fecha}` : ""}` : fecha}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${getNotaColor(
                                      n.nota
                                    )} border-white/10`}
                                  >
                                    {n.nota !== null ? Number(n.nota).toFixed(1) : "-"}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
