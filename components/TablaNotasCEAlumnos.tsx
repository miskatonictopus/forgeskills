"use client";

import React, { useEffect, useMemo, useState } from "react";

type Alumno = { id: string; nombre: string; apellidos: string };
type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

type NotaDetallada = {
  alumno_id: string;
  ce_codigo: string;           // ej: "CE1.4" (UPPER, sin espacios, sin "RA1.")
  actividad_id: string;
  actividad_fecha?: string | null;
  actividad_nombre?: string | null;
  nota: number | null;
};

type Props = {
  alumnos: Alumno[];
  ra: RA[];                    // solo lo usamos para sacar el catálogo de CE únicos
  notasDetalle: NotaDetallada[];
};

const normCE = (s: string) => String(s ?? "").trim().toUpperCase().replace(/\s+/g,"");

function getNotaColor(nota: number | null) {
  if (nota === null || isNaN(nota)) return "text-muted-foreground";
  if (nota < 5) return "text-red-600 dark:text-red-400";
  if (nota < 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

// Ordena CE1.1, CE1.2, CE2.1… de forma “humana”
function sortCE(a: string, b: string) {
  const parse = (s: string) => {
    const m = /^CE(\d+)\.(\d+)$/i.exec(normCE(s));
    return m ? [parseInt(m[1],10), parseInt(m[2],10)] : [9999, 9999];
  };
  const [raA, ceA] = parse(a);
  const [raB, ceB] = parse(b);
  if (raA !== raB) return raA - raB;
  return ceA - ceB;
}

export default function TablaNotasCEAlumnos({ alumnos, ra, notasDetalle = [] }: Props) {
  // Índice: (alumnoId|CE) -> array de notas por actividad (ordenadas por fecha)
  const idx = useMemo(() => {
    const m = new Map<string, NotaDetallada[]>();
    for (const raw of notasDetalle) {
      const n = {
        ...raw,
        alumno_id: String(raw.alumno_id),
        ce_codigo: normCE(raw.ce_codigo),
      };
      const key = `${n.alumno_id}::${n.ce_codigo}`;
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

  // Catálogo de CE únicos (ignorando RA)
  const ceCatalogo: CE[] = useMemo(() => {
    const map = new Map<string, string>(); // codigo -> descripcion
    for (const r of ra ?? []) {
      for (const ce of r.CE ?? []) {
        const code = normCE(ce.codigo);
        if (!code) continue;
        if (!map.has(code)) map.set(code, ce.descripcion ?? "");
      }
    }
    // si por lo que sea hay CE en notas que no están en el catálogo RA, añádelos:
    for (const n of notasDetalle) {
      const code = normCE(n.ce_codigo);
      if (code && !map.has(code)) map.set(code, "");
    }
    return Array.from(map.entries())
      .sort((a,b) => sortCE(a[0], b[0]))
      .map(([codigo, descripcion]) => ({ codigo, descripcion }));
  }, [ra, notasDetalle]);

  const notasDe = (alumnoId: string, ceCodigo: string) =>
    idx.get(`${String(alumnoId)}::${normCE(ceCodigo)}`) ?? [];

  return (
    <div className="space-y-4">
      <div className="overflow-auto max-h-[75vh] border rounded-xl shadow">
        <table className="min-w-max table-auto text-sm">
          <thead className="bg-muted/50">
            <tr className="sticky top-0 z-10 bg-muted border-b border-muted">
              <th className="sticky text-xs left-0 bg-muted px-4 py-2 font-bold text-left border-r border-muted">
                CE / Alumno
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
            {ceCatalogo.map((ce) => (
              <tr key={`row-${ce.codigo}`} className="border-t">
                <td className="sticky left-0 bg-background px-4 py-2 text-muted-foreground text-xs border-r border-muted w-72 whitespace-normal break-words">
                  <span className="font-medium text-foreground">{ce.codigo}</span>
                  {ce.descripcion ? <> – {ce.descripcion}</> : null}
                </td>

                {alumnos.map((alumno, index) => {
                  const arr = notasDe(alumno.id, ce.codigo);
                  return (
                    <td
                      key={`cell-${alumno.id}-${ce.codigo}`}
                      className={`px-2 py-1 align-top ${index !== 0 ? "border-l border-white/10" : ""}`}
                    >
                      {arr.length === 0 ? (
                        <div className="w-10 text-sm text-center text-muted-foreground">-</div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {arr.map((n) => {
                            const fecha =
                              n.actividad_fecha && !isNaN(Date.parse(n.actividad_fecha))
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
