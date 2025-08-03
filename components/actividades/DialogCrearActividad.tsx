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

import { Bot, FileText } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
};

export function DialogCrearActividad({ open, onOpenChange, cursoId, setRefreshKey }: Props) {
  const snap = useSnapshot(asignaturasPorCurso);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [asignaturaId, setAsignaturaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const asignaturas = snap[cursoId] || [];

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

      // Reset
      onOpenChange(false);
      setNombre("");
      setFecha("");
      setAsignaturaId("");
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

    const palabras = texto?.trim().split(/\s+/).length || 0;
  
    console.log("Texto extraído:", texto);
  
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nueva actividad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Práctica 1"
            />
          </div>

          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div>
            <Label>Asignatura</Label>
            <select
              value={asignaturaId}
              onChange={(e) => {
                setAsignaturaId(e.target.value);
                setCesDetectados([]); // Limpiar CE si cambia asignatura
              }}
              className="w-full border rounded px-2 py-1 text-sm bg-background"
            >
              <option value="">Selecciona una asignatura</option>
              {asignaturas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Descripción de la actividad</Label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe aquí la actividad con detalle o sube un PDF para extraer el contenido"
              className="w-full border rounded px-2 py-1 text-sm bg-background min-h-[120px]"
            />
          </div>

          <div>
            <Label>O bien sube un archivo PDF</Label>
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setArchivo(file);
                  // @ts-ignore
                  const filePath = file.path;
                  handleExtraerTexto(filePath);
                }
              }}
            />
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
