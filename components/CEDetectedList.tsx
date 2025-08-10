"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type ResultadoCE = {
  codigo: string;
  descripcion: string;
  puntuacion: number;
  evidencias?: string[];
  reason?: "evidence" | "high_sim" | "lang_rule";
  justificacion?: string;
};

export function CEDetectedList({
  results,
  onRemove,
  debug = false,
}: {
  results: ResultadoCE[];
  onRemove?: (codigo: string) => void;
  debug?: boolean;
}) {
  const ordered = useMemo(
    () => [...results].sort((a, b) => b.puntuacion - a.puntuacion),
    [results]
  );

  if (debug) console.log("[CEDetectedList] results >", results);

  const makeWhy = (r: ResultadoCE) => {
    if (r.justificacion && r.justificacion.trim()) return r.justificacion;

    const pct = `${(r.puntuacion * 100).toFixed(1)}%`;
    let base =
      r.reason === "high_sim"
        ? `Coincidencia semántica alta (${pct}) entre la descripción de la actividad y el criterio.`
        : r.reason === "lang_rule"
        ? `Menciones claras a lenguajes/tecnologías del lado cliente que vinculan con el criterio (${pct}).`
        : `Enunciados alineados con la acción y objetos del criterio (${pct}).`;

    if (r.evidencias?.length) {
      const muestras = r.evidencias.slice(0, 2).map(e => `“${e}”`).join("  ·  ");
      base += `\nEvidencias: ${muestras}.`;
    }
    return base;
  };

  const badgeFor = (r: ResultadoCE) => {
    if (r.reason === "high_sim") return <Badge variant="secondary">Alta similitud</Badge>;
    if (r.reason === "lang_rule") return <Badge variant="secondary">Lenguajes</Badge>;
    return <Badge>Con evidencias</Badge>;
  };

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-sm font-semibold mb-2">CE detectados:</p>

      <div className="space-y-3">
        {ordered.map((r) => (
          <div key={r.codigo} className="rounded-md border border-zinc-800 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.codigo}</p>
                <p className="text-sm text-muted-foreground">{r.descripcion}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-emerald-400 text-sm font-semibold">
                  {(r.puntuacion * 100).toFixed(1)}%
                </p>
                {badgeFor(r)}
              </div>
            </div>

            <div className="mt-2">
              <Progress value={Math.round(r.puntuacion * 100)} />
            </div>

            {/* JUSTIFICACIÓN SIEMPRE VISIBLE */}
            <div className="mt-2 rounded-md bg-zinc-800/50 p-2">
              <p className="text-xs text-zinc-300 whitespace-pre-wrap">
                {makeWhy(r)}
              </p>
              {r.evidencias?.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-zinc-400">
                  {r.evidencias.slice(0, 3).map((ev, i) => (
                    <li key={i} className="break-words">{ev}</li>
                  ))}
                </ul>
              ) : null}
              {onRemove && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => onRemove(r.codigo)}>
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
