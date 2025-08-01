import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Bot } from "lucide-react";
import { Actividad } from "@/store/actividadesPorCurso";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividad: Actividad | null;
};

export function DialogVerActividad({ open, onOpenChange, actividad }: Props) {
  const [cesDetectados, setCesDetectados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!actividad) return null;

  const handleAnalizar = async () => {
    if (!actividad.descripcion) {
      toast.error("La actividad no tiene descripción.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/analizar-ce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: actividad.descripcion }),
      });

      const data = await res.json();
      setCesDetectados(data.ce || []);
    } catch (err) {
      toast.error("Error al analizar la actividad.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actividad.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <CalendarDays className="inline w-4 h-4 mr-1" />
            {new Date(actividad.fecha).toLocaleDateString("es-ES")}
          </p>
          <p><strong>Asignatura:</strong> {actividad.asignaturaId}</p>

          {actividad.descripcion && (
            <div className="mt-4">
              <strong>Descripción:</strong>
              <p className="whitespace-pre-wrap mb-2">{actividad.descripcion}</p>
              <Button onClick={handleAnalizar} disabled={loading}>
                <Bot className="w-4 h-4 mr-2" />
                {loading ? "Analizando..." : "Analizar descripción"}
              </Button>
            </div>
          )}

          {cesDetectados.length > 0 && (
            <div className="mt-4 bg-muted p-3 rounded border">
              <strong>CE detectados:</strong>
              <ul className="list-disc ml-4 mt-2">
                {cesDetectados.map((ce, index) => (
                  <li key={index}>{ce}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
