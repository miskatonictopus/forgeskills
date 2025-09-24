"use client";

import React, { useMemo } from "react";

type Alumno = { id: string; nombre: string; apellidos: string };
type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

export type NotaDetallada = {
  alumno_id: string;
  ce_codigo: string;
  actividad_id: string | null;
  actividad_fecha?: string | null;
  actividad_nombre?: string | null;
  nota: number | null;
};

type Props = {
  alumnos: Alumno[];
  ra: RA[];
  notasDetalle: NotaDetallada[];
};

const normCE = (s: string) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^RA\d+\./, ""); // elimina prefijo "RA1." si viene

const normRA = (s: string) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

// color segun nota
function getNotaColor(nota: number | null) {
  if (nota === null || Number.isNaN(nota)) return "text-muted-foreground";
  if (nota < 5) return "text-red-600 dark:text-red-400";
  if (nota < 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

// CE1.1, CE2.3 → orden humano por RA y CE
function sortCE(a: string, b: string) {
  const [raA, ceA] = parseCE(a);
  const [raB, ceB] = parseCE(b);
  if (raA !== raB) return raA - raB;
  return ceA - ceB;
}

// Devuelve [raNum, ceNum] desde un código CE normalizado
function parseCE(code: string): [number, number] {
  const m = /^CE(\d+)\.(\d+)$/i.exec(normCE(code));
  if (!m) return [9999, 9999];
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

export default function TablaNotasCEAlumnos({
  alumnos = [],
  ra = [],
  notasDetalle = [],
}: Props) {
  // Índice (alumnoId|CE) -> lista de notas por actividad (ordenadas por fecha asc)
  const idx = useMemo(() => {
    const m = new Map<string, NotaDetallada[]>();
    for (const raw of notasDetalle ?? []) {
      const n: NotaDetallada = {
        ...raw,
        alumno_id: String(raw.alumno_id),
        ce_codigo: normCE(raw.ce_codigo),
        actividad_id: raw.actividad_id ?? null,
        actividad_fecha: raw.actividad_fecha ?? null,
        actividad_nombre: raw.actividad_nombre ?? null,
        nota: raw.nota ?? null,
      };
      const key = `${n.alumno_id}::${n.ce_codigo}`;
      const arr = m.get(key) ?? [];
      arr.push(n);
      m.set(key, arr);
    }
    // ordenar por fecha asc (sin fecha al final)
    for (const [k, arr] of m) {
      arr.sort((a, b) => {
        const ta = a.actividad_fecha ? Date.parse(String(a.actividad_fecha)) : Number.MAX_SAFE_INTEGER;
        const tb = b.actividad_fecha ? Date.parse(String(b.actividad_fecha)) : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
      m.set(k, arr);
    }
    return m;
  }, [notasDetalle]);

  // Catálogo único de CEs (desde RA + desde notas), ordenado por RA y CE
  const ceCatalogo: CE[] = useMemo(() => {
    const map = new Map<string, string>(); // codigo -> descripcion
    for (const r of ra ?? []) {
      for (const ce of r.CE ?? []) {
        const code = normCE(ce.codigo);
        if (code && !map.has(code)) map.set(code, ce.descripcion ?? "");
      }
    }
    for (const n of notasDetalle ?? []) {
      const code = normCE(n.ce_codigo);
      if (code && !map.has(code)) map.set(code, "");
    }
    return Array.from(map.entries())
      .sort((a, b) => sortCE(a[0], b[0]))
      .map(([codigo, descripcion]) => ({ codigo, descripcion }));
  }, [ra, notasDetalle]);

  // Mapa raNum -> { codigo: "RA1", descripcion: string }
  const raInfoByNum = useMemo(() => {
    const map = new Map<number, { codigo: string; descripcion: string }>();
    for (const r of ra ?? []) {
      const code = normRA(r.codigo); // "RA1"
      const m = /^RA(\d+)$/i.exec(code);
      if (m) {
        const num = parseInt(m[1], 10);
        map.set(num, { codigo: `RA${num}`, descripcion: r.descripcion ?? "" });
      }
    }
    return map;
  }, [ra]);

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
                  className={`px-4 py-2 font-medium text-xs text-left whitespace-nowrap ${i !== 0 ? "border-l border-white/10" : ""}`}
                >
                  {a.apellidos}, {a.nombre}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(() => {
              let lastRaNum: number | null = null;
              const rows: React.ReactNode[] = [];

              for (const ce of ceCatalogo) {
                const [raNum] = parseCE(ce.codigo);
                const raChanged = raNum !== lastRaNum;

                if (raChanged) {
                  lastRaNum = raNum;
                  const info = raInfoByNum.get(raNum);
                  const label = info?.codigo ?? (Number.isFinite(raNum) ? `RA${raNum}` : "RA");
                  const desc = info?.descripcion ?? "";

                  // Fila de RA a todo el ancho (encabezado de bloque)
                  rows.push(
                    <tr key={`ra-${label}`} className="bg-muted/40">
                      <td className="px-4 py-2 font-semibold text-foreground" colSpan={1 + alumnos.length}>
                        {label}
                        {desc ? <> — <span className="text-muted-foreground font-normal">{desc}</span></> : null}
                      </td>
                    </tr>
                  );
                }

                // Fila del CE
                rows.push(
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
                              {arr.map((n, i) => {
                                const fecha =
                                  n.actividad_fecha && !Number.isNaN(Date.parse(String(n.actividad_fecha)))
                                    ? new Date(String(n.actividad_fecha)).toLocaleDateString("es-ES")
                                    : "";
                                const titulo = n.actividad_nombre || "";
                                const pillKey = `pill-${n.actividad_id ?? "noact"}-${alumno.id}-${ce.codigo}-${i}`;
                                return (
                                  <span
                                    key={pillKey}
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
                );
              }

              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
