"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// el shape que consume CEDetectedList
type ResultadoCE = {
  codigo: string;
  descripcion: string;
  puntuacion: number;      // 0..1
  evidencias?: string[];
  reason?: "evidence" | "high_sim" | "lang_rule";
  justificacion?: string;
};

type CriterioEvaluacion = { codigo: string; descripcion: string };

type Props = {
  criterios: CriterioEvaluacion[];
  // IMPORTANT: ahora devolvemos objetos completos, no string[]
  onResultado: (cesDetectados: ResultadoCE[]) => void;
};

export function InterpretadorCE({ criterios, onResultado }: Props) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);

  // mapea lo que venga de la API al shape ResultadoCE[]
  const normalizar = (raw: any): ResultadoCE[] => {
    if (!raw) return [];
    // si ya vienen objetos completos
    if (Array.isArray(raw) && typeof raw[0] === "object") {
      return raw.map((r: any) => ({
        codigo: r.codigo,
        descripcion:
          r.descripcion ??
          criterios.find((c) => c.codigo === r.codigo)?.descripcion ??
          "",
        puntuacion: typeof r.puntuacion === "number" ? r.puntuacion : 0.6, // valor por defecto
        evidencias: r.evidencias ?? [],
        reason: r.reason ?? "evidence",
        justificacion: r.justificacion ?? "",
      }));
    }
    // si vienen solo códigos (string[])
    if (Array.isArray(raw) && typeof raw[0] === "string") {
      return raw.map((codigo: string) => {
        const ce = criterios.find((c) => c.codigo === codigo);
        return {
          codigo,
          descripcion: ce?.descripcion ?? "",
          puntuacion: 0.62,     // default razonable
          evidencias: [],
          reason: "high_sim",   // marcamos como alta similitud si no hay evidencias
          justificacion: "",
        };
      });
    }
    return [];
  };

  const interpretar = async () => {
    if (!texto.trim()) {
      toast.error("Introduce una descripción de la actividad.");
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/analizar-ce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, criterios }), // pasa criterios si tu API los usa
      });
      const data = await res.json();

      const resultadoNormalizado = normalizar(data?.resultado);
      if (!resultadoNormalizado.length) {
        toast.error("No se detectaron CE o el formato de respuesta no es válido.");
        return;
      }

      onResultado(resultadoNormalizado);
      toast.success(`Detectados ${resultadoNormalizado.length} CE.`);
    } catch (e) {
      console.error(e);
      toast.error("Fallo al conectar con el motor de análisis.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Descripción de la actividad</Label>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej: Informe técnico sobre estándares W3C, validación HTML/CSS, pruebas de usabilidad..."
        rows={5}
      />
      <Button onClick={interpretar} disabled={cargando}>
        {cargando ? "Analizando..." : "Detectar CE automáticamente"}
      </Button>
    </div>
  );
}
