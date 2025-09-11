"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type ResultadoCE = {
  codigo: string;               // p.ej. "RA2.CE3" o "CE3"
  descripcion: string;
  puntuacion: number;           // 0..1
  evidencias?: string[];
  reason?: "evidence" | "high_sim" | "lang_rule";
  justificacion?: string;
};

// Acepta tanto ResultadoCE “clásico” como la forma { raCodigo, ceCodigo, ceDescripcion, ... }
type ResultadoEntrada = ResultadoCE & {
  id?: string;
  key?: string;
  raCodigo?: string;
  ceCodigo?: string;
  ceDescripcion?: string;
};

export function CEDetectedList({
  results,
  onRemove,
  debug = false,
}: {
  results: ResultadoEntrada[] | any;       // flexible y tolerante
  onRemove?: (codigo: string) => void;
  debug?: boolean;
}) {
  const safe: ResultadoEntrada[] = Array.isArray(results) ? results : [];

  // Normaliza cada item a un shape estable
  const normalized = useMemo(() => {
    return safe.map((r, i) => {
      const composed =
        r?.raCodigo && r?.ceCodigo ? `${String(r.raCodigo)}.${String(r.ceCodigo)}` : undefined;

      const codigo = r?.codigo ?? composed ?? `row-${i}`;
      const descripcion = r?.descripcion ?? r?.ceDescripcion ?? "";
      const puntuacion =
        typeof r?.puntuacion === "number" && isFinite(r.puntuacion) ? r.puntuacion : 1;

      const key = r?.id ?? r?.key ?? composed ?? (r?.codigo ? `ce-${r.codigo}` : `row-${i}`);

      return {
        key,
        codigo,
        descripcion,
        puntuacion,
        evidencias: r?.evidencias ?? [],
        reason: r?.reason as ResultadoCE["reason"],
        justificacion: r?.justificacion as string | undefined,
      };
    });
  }, [safe]);

  const ordered = useMemo(
    () => [...normalized].sort((a, b) => (b.puntuacion ?? 0) - (a.puntuacion ?? 0)),
    [normalized]
  );

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[CEDetectedList] normalized >", normalized);
  }

  const makeWhy = (r: {
    puntuacion: number;
    reason?: ResultadoCE["reason"];
    justificacion?: string;
    evidencias?: string[];
  }) => {
    if (r.justificacion && r.justificacion.trim()) return r.justificacion;

    const pct = `${(r.puntuacion * 100).toFixed(1)}%`;
    let base =
      r.reason === "high_sim"
        ? `Coincidencia semántica alta (${pct}) entre la descripción de la actividad y el criterio.`
        : r.reason === "lang_rule"
        ? `Menciones claras a lenguajes/tecnologías del lado cliente que vinculan con el criterio (${pct}).`
        : `Enunciados alineados con la acción y objetos del criterio (${pct}).`;

    if (r.evidencias?.length) {
      const muestras = r.evidencias.slice(0, 2).map((e) => `“${e}”`).join("  ·  ");
      base += `\nEvidencias: ${muestras}.`;
    }
    return base;
  };

  const badgeFor = (r: { reason?: ResultadoCE["reason"] }) => {
    if (r.reason === "high_sim") return <Badge variant="secondary">Alta similitud</Badge>;
    if (r.reason === "lang_rule") return <Badge variant="secondary">Lenguajes</Badge>;
    return <Badge>Con evidencias</Badge>;
  };

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-sm font-semibold mb-2">CE detectados:</p>

      <div className="space-y-3">
        {ordered.map((r) => (
          <div key={r.key} className="rounded-md border border-zinc-800 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{r.codigo}</p>
                {r.descripcion ? (
                  <p className="text-sm text-muted-foreground break-words">{r.descripcion}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-emerald-400 text-sm font-semibold">
                  {(Math.max(0, Math.min(1, r.puntuacion)) * 100).toFixed(1)}%
                </p>
                {badgeFor(r)}
              </div>
            </div>

            <div className="mt-2">
              <Progress value={Math.round(Math.max(0, Math.min(1, r.puntuacion)) * 100)} />
            </div>

            {/* JUSTIFICACIÓN SIEMPRE VISIBLE */}
            <div className="mt-2 rounded-md bg-zinc-800/50 p-2">
              <p className="text-xs text-zinc-300 whitespace-pre-wrap">{makeWhy(r)}</p>

              {/* Evidencias */}
              {Array.isArray(r.evidencias) && r.evidencias.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-zinc-400">
                  {r.evidencias.slice(0, 3).map((ev, i) => (
                    <li key={`ev-${r.key}-${i}`} className="break-words">
                      {ev}
                    </li>
                  ))}
                </ul>
              )}

              {onRemove && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => onRemove(r.codigo)}
                  >
                    Quitar
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
