"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CriterioEvaluacion = {
  codigo: string;
  descripcion: string;
};

type Props = {
  criterios: CriterioEvaluacion[];
  onResultado: (cesDetectados: string[]) => void;
};

export function InterpretadorCE({ criterios, onResultado }: Props) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);

  const interpretar = async () => {
    if (!texto.trim()) {
      toast.error("Introduce una descripción de la actividad.");
      return;
    }

    setCargando(true);

    try {
      const prompt = `
Eres un experto en evaluación educativa. A continuación tienes una actividad de FP y una lista de criterios de evaluación (CE). Devuélveme solo los códigos de los CE que se relacionan con la actividad.

ACTIVIDAD:
${texto}

CRITERIOS DE EVALUACIÓN:
${criterios.map((ce) => `- ${ce.codigo}: ${ce.descripcion}`).join("\n")}

RESPUESTA ESPERADA (JSON):
["CE1.1", "CE1.3"]
      `.trim();

      const respuesta = await fetch("/api/interpretar-ce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await respuesta.json();
      if (!Array.isArray(data.resultado)) {
        toast.error("Error al interpretar los CE.");
        return;
      }

      onResultado(data.resultado);
      toast.success("CE sugeridos correctamente.");
    } catch (err) {
      console.error(err);
      toast.error("Fallo al conectar con el motor semántico.");
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
        placeholder="Ej: Diseñar una API RESTful que permita..."
        rows={5}
      />
      <Button onClick={interpretar} disabled={cargando}>
        {cargando ? "Interpretando..." : "Detectar CE automáticamente"}
      </Button>
    </div>
  );
}
