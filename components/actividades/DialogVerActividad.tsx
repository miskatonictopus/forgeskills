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
      const ceDetectados: string[] = await window.electronAPI.analizarDescripcion(actividad.id);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              <div className="mt-2 max-h-40 overflow-y-auto pr-2">
                <ul className="list-disc ml-4 text-sm space-y-1">
                  {cesDetectados.map((ce, index) => (
                    <li key={index}>{ce}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
