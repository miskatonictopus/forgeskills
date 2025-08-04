"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { useSnapshot } from "valtio";
import { cargarActividades, añadirActividad } from "@/store/actividadesPorCurso";
import { Bot, FileUp } from "lucide-react";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";



type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  asignaturaNombre?: string;
};

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdExterna, // Renombramos para no chocar
}: Props) {
  const snap = useSnapshot(asignaturasPorCurso);
  const asignaturas = snap[cursoId] || [];
  const [fechaObj, setFechaObj] = useState<Date | undefined>(undefined);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [asignaturaId, setAsignaturaId] = useState(asignaturaIdExterna || "");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && asignaturaIdExterna) {
      setAsignaturaId(asignaturaIdExterna);
    }
  }, [open, asignaturaIdExterna]);

  const handleGuardar = async () => {
    if (!nombre || !fecha || !asignaturaId) {
      toast.error("Por favor, completa todos los campos.");
      return;
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha,
      cursoId,
      asignaturaId,
      descripcion,
    };

    try {
      await window.electronAPI.guardarActividad(nuevaActividad);
      añadirActividad(cursoId, nuevaActividad);
      toast.success("Actividad guardada correctamente.");

      onOpenChange(false);
      setNombre("");
      setFecha("");
      setAsignaturaId(asignaturaIdExterna || "");
      setDescripcion("");
      setArchivo(null);
      setCesDetectados([]);
    } catch (err) {
      toast.error("Error al guardar la actividad.");
      console.error(err);
    }
  };

  const handleExtraerTexto = async (filePath: string) => {
    if (!asignaturaId) {
      toast.warning("Selecciona primero una asignatura.");
      return;
    }

    const texto = await window.electronAPI.extraerTextoPDF(filePath);
    const palabras = (texto ?? "").split(/\s+/).filter(Boolean).length;

    if (!texto || palabras < 5) {
      toast.error(`Texto insuficiente: ${palabras} palabras detectadas.`);
      return;
    }

    setDescripcion(texto);
    const ceDetectados = await window.electronAPI.analizarDescripcionDesdeTexto(texto, asignaturaId);

    if (!ceDetectados || ceDetectados.length === 0) {
      toast.warning("No se han detectado CE relevantes.");
    } else {
      toast.success(`🎯 ${ceDetectados.length} CE detectados automáticamente.`);
      setCesDetectados(ceDetectados);
    }
  };

  const asignaturaNombre = asignaturas.find((a) => a.id === asignaturaId)?.nombre || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
        <DialogTitle className="font-light">
  Crear nueva actividad {asignaturaNombre && <>para<br/><p className="font-bold mt-2">{asignaturaNombre}</p></>}
</DialogTitle>

        </DialogHeader>
        <Separator className="my-3" />
        <div className="space-y-4">
          <div>
            <Label className="mb-2">Nombre de la actividad</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Práctica 1"
            />
          </div>

          <div className="flex flex-col ">
  <Label className="mb-2">Fecha</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant={"outline"}
        className="w-full justify-start text-left font-normal"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {fechaObj ? format(fechaObj, "dd/MM/yyyy") : <span>Elige una fecha</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={fechaObj}
        onSelect={(date) => {
          setFechaObj(date);
          setFecha(date?.toISOString().split("T")[0] || ""); // opcional: mantiene el formato "yyyy-mm-dd"
        }}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>


          

          <div>
            <Label className="mb-2">Descripción de la actividad</Label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe aquí la actividad..."
              className="w-full border rounded px-2 py-1 text-sm bg-background min-h-[120px]"
            />
          </div>

          <div>
          <Label className="mb-2 flex justify-between items-center w-full">
  O bien sube un archivo
  <span className="text-xs text-neutral-500">
    archivos permitidos:<br/>PDF / Pages / Word / txt
  </span>
</Label>
<div className="flex items-center gap-2 mt-2">
  <input
    id="archivo"
    type="file"
    accept=".pdf,.doc,.docx,.pages,.txt"
    className="hidden"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      const ruta = await window.electronAPI.guardarPDF(arrayBuffer, file.name);

      if (!ruta) {
        toast.error("No se pudo guardar el archivo.");
        return;
      }

      console.log("✅ PDF guardado en:", ruta);
      setArchivo(file);
      handleExtraerTexto(ruta);
    }}
    disabled={loading}
  />

<label
  htmlFor="archivo"
  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-muted rounded cursor-pointer hover:bg-muted/80"
>
  <FileUp className="w-4 h-4" />
  Subir archivo
</label>

  {archivo && (
    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
      {archivo.name}
    </span>
  )}
</div>
          </div>

          {cesDetectados.length > 0 && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <Label>CE Detectados automáticamente</Label>
              <ul className="space-y-1 pl-5">
                {cesDetectados.map((ce, i) => {
                  let color = "text-red-500";
                  if (ce.puntuacion >= 0.7) color = "text-green-600";
                  else if (ce.puntuacion >= 0.5) color = "text-orange-500";

                  return (
                    <li key={i} className={`${color} text-sm`}>
                      <strong>{ce.codigo}</strong> — {(ce.puntuacion * 100).toFixed(1)}%
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <Button className="w-full mt-4" onClick={handleGuardar}>
            <Bot className="w-4 h-4 mr-2" /> Guardar actividad
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
