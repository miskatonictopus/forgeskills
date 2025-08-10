"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Bot } from "lucide-react";
import { Actividad } from "@/store/actividadesPorCurso";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividad: Actividad | null;
  asignaturaNombre?: string;
};

type CEDetectado = {
  codigo: string;
  descripcion: string;
  puntuacion: number;
};

export function DialogVerActividad({ open, onOpenChange, actividad, asignaturaNombre}: Props) {
  const [cesDetectados, setCesDetectados] = useState<CEDetectado[]>([]);
  const [loading, setLoading] = useState(false);

  if (!actividad) return null;

  const handleAnalizar = async () => {
    if (!actividad?.descripcion) {
      toast.error("La actividad no tiene descripción.");
      return;
    }
    try {
      setLoading(true);
      setCesDetectados([]);
      const ceDetectados = (await window.electronAPI.analizarDescripcion(actividad.id)) as CEDetectado[];
      if (!ceDetectados || ceDetectados.length === 0) {
        toast.warning("No se han detectado CE relevantes.");
      } else {
        setCesDetectados(ceDetectados);
        toast.success("CE detectados con éxito.");
      }
    } catch (err) {
      toast.error("Error al analizar la descripción.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">{actividad.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <CalendarDays className="inline w-4 h-4 mr-1" />
            {new Date(actividad.fecha).toLocaleDateString("es-ES")}
          </p>
          <p>
    <strong>Asignatura:</strong>{" "}
    <span className="uppercase">
      {asignaturaNombre || actividad.asignaturaId}
    </span>
  </p>
  <Separator className="my-3" />

          {actividad.descripcion && (
            <div className="mt-4">
              <strong className="text-white mb-4">Descripción:</strong>
              <p className="whitespace-pre-wrap mb-2 text-md">{actividad.descripcion}</p>
              <Separator className="my-3" />
              <Button onClick={handleAnalizar} disabled={loading}>
                <Bot className="w-4 h-4 mr-2" />
                {loading ? "Analizando..." : "Analizar descripción"}
              </Button>
            </div>
          )}

          {cesDetectados.length > 0 && (
            <div className="mt-4 bg-muted p-3 rounded border">
              <strong>CE detectados:</strong>
              <div className="mt-2 space-y-4 pr-2 max-h-[40vh] overflow-y-auto">
                {cesDetectados.map((ce) => (
                  <div key={ce.codigo} className="text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ce.codigo}</span>
                      <span
                        className={cn(
                          "ml-2",
                          ce.puntuacion > 0.45
                            ? "text-green-600"
                            : ce.puntuacion >= 0.42
                            ? "text-yellow-600"
                            : "text-red-600"
                        )}
                      >
                        ({(ce.puntuacion * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {ce.descripcion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
