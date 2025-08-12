"use client";

type Horario = {
  cursoId?: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";

// util: “Lunes/Martes/…” => “lunes/martes/…”
const normDia = (d: string) => {
  const x = (d || "").trim().toLowerCase();
  if (x === "miercoles") return "miércoles";
  if (x === "sabado") return "sábado";
  return x;
};

function generarIntervalosHora(inicio: string, fin: string): string[] {
  const resultado: string[] = [];
  let [hora, minuto] = inicio.split(":").map(Number);
  const [horaFin, minutoFin] = fin.split(":").map(Number);
  while (hora < horaFin || (hora === horaFin && minuto <= minutoFin)) {
    const h = hora.toString().padStart(2, "0");
    const m = minuto.toString().padStart(2, "0");
    resultado.push(`${h}:${m}`);
    minuto += 30;
    if (minuto >= 60) {
      minuto = 0;
      hora += 1;
    }
  }
  return resultado;
}

function calcularDuracion(inicio: string, fin: string): number {
  const [hInicio, mInicio] = inicio.split(":").map(Number);
  const [hFin, mFin] = fin.split(":").map(Number);
  return (hFin * 60 + mFin - (hInicio * 60 + mInicio)) / 60;
}

function calcularTotalHoras(horarios: Horario[]): number {
  return horarios.reduce((total, h) => total + calcularDuracion(h.horaInicio, h.horaFin), 0);
}

type Props = {
  open: boolean;
  onClose: () => void;
  asignatura: { id: string; nombre: string };
  onSave?: (id: string) => void;
};

export function HorarioDialog({ open, onClose, asignatura, onSave }: Props) {
  const snapCursos = useSnapshot(cursoStore);

  const [cursoId, setCursoId] = useState<string>("");
  const [dia, setDia] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [horarios, setHorarios] = useState<Horario[]>([]);
  

  // preselección de curso si solo hay uno
  useEffect(() => {
    if (!cursoId && Array.isArray(snapCursos.cursos) && snapCursos.cursos.length === 1) {
      setCursoId(snapCursos.cursos[0].id);
    }
  }, [snapCursos.cursos, cursoId]);

  // carga de horarios cuando se abre o cambia curso
  useEffect(() => {
    if (!open) return;

    const cargar = async () => {
      try {
        // Preferente: API que acepta cursoId y asignaturaId
        // @ts-ignore
        if (typeof window.electronAPI?.leerHorarios === "function") {
          // intentamos con firma (asignaturaId, cursoId)
          let data: Horario[] | undefined;
          try {
            // @ts-ignore
            data = await window.electronAPI.leerHorarios(asignatura.id, cursoId);
          } catch {
            // fallback a firma antigua (solo asignaturaId)
            // @ts-ignore
            data = await window.electronAPI.leerHorarios(asignatura.id);
          }
          // si llega mezcla de cursos, filtra por cursoId si está seleccionado
          const filtrado =
            cursoId && Array.isArray(data)
              ? data.filter((h: any) => !h.cursoId || h.cursoId === cursoId)
              : (data ?? []);
          setHorarios(
            (filtrado as any[]).map((h) => ({
              cursoId: h.cursoId ?? cursoId ?? "",
              dia: normDia(h.dia),
              horaInicio: h.horaInicio ?? h.hora_inicio,
              horaFin: h.horaFin ?? h.hora_fin,
            }))
          );
        }
      } catch {
        toast.error("Error al leer horarios");
      }
    };

    cargar();
  }, [open, asignatura.id, cursoId]);

  const cargarHorarios = async (id: string) => {
    // recarga tras guardar/borrar
    try {
      // @ts-ignore
      let data: Horario[] = await window.electronAPI.leerHorarios(id, cursoId);
      if (!Array.isArray(data)) {
        // @ts-ignore
        data = await window.electronAPI.leerHorarios(id);
      }
      const filtrado =
        cursoId && Array.isArray(data)
          ? data.filter((h: any) => !h.cursoId || h.cursoId === cursoId)
          : (data ?? []);
      setHorarios(
        (filtrado as any[]).map((h) => ({
          cursoId: h.cursoId ?? cursoId ?? "",
          dia: normDia(h.dia),
          horaInicio: h.horaInicio ?? h.hora_inicio,
          horaFin: h.horaFin ?? h.hora_fin,
        }))
      );
    } catch {
      toast.error("Error al leer horarios");
    }
  };

  const handleAñadir = async () => {
    if (!cursoId) {
      toast.error("Selecciona un curso");
      return;
    }
    if (!dia || !horaInicio || !horaFin) return;

    const [h1, m1] = horaInicio.split(":").map(Number);
    const [h2, m2] = horaFin.split(":").map(Number);
    if (h2 * 60 + m2 <= h1 * 60 + m1) {
      toast.error(
        "Nuestra aplicación todavía no puede viajar atrás en el tiempo, estamos trabajando en ello, la hora fin no puede ser menor que la hora inicio"
      );
      return;
    }

    try {
      // Enviar SIEMPRE cursoId
      // @ts-ignore
      await window.electronAPI.guardarHorario({
        cursoId,
        asignaturaId: asignatura.id,
        dia: normDia(dia),
        horaInicio,
        horaFin,
      });

      await cargarHorarios(asignatura.id);
      toast.success("Horario añadido correctamente");

      setDia("");
      setHoraInicio("");
      setHoraFin("");
      onSave?.(asignatura.id);
    } catch (err) {
      toast.error("Error al guardar horario");
      console.error(err);
    }
  };

  const handleEliminar = async (d: string, hIni: string) => {
    try {
      // @ts-ignore
      await window.electronAPI.borrarHorario({
        cursoId,
        asignaturaId: asignatura.id,
        dia: d,
        horaInicio: hIni,
      });

      await cargarHorarios(asignatura.id);
      onSave?.(asignatura.id);
      toast.success("Horario eliminado");
    } catch (error) {
      toast.error("Error al borrar horario");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 text-white">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Insertar / Eliminar horario para {asignatura.id}</DialogTitle>
            <span className="text-emerald-200 text-4xl font-bold mr-4 whitespace-nowrap">
              {calcularTotalHoras(horarios)}h
            </span>
          </div>
          <DialogDescription className="text-zinc-400 uppercase">
            {asignatura.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Selector de curso */}
          <div className="flex w-full gap-4 items-end">
            <div className="w-1/3 space-y-1">
              <Label className="mb-2">Curso</Label>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent>
                  {(snapCursos.cursos ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`${c.acronimo ?? ""}${c.nivel ?? ""}${c.clase ?? ""}` || c.nombre || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/3 space-y-1">
              <Label className="mb-2">Día de la semana</Label>
              <Select value={dia} onValueChange={setDia}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un día" />
                </SelectTrigger>
                <SelectContent>
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/6 space-y-1">
              <Label className="mb-2">Inicio</Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="inicio" />
                </SelectTrigger>
                <SelectContent>
                  {generarIntervalosHora("08:00", "21:00").map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/6 space-y-1">
              <Label className="mb-2">Fin</Label>
              <Select value={horaFin} onValueChange={setHoraFin}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="fin" />
                </SelectTrigger>
                <SelectContent>
                  {generarIntervalosHora("08:30", "21:00").map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAñadir} variant="secondary">
              Añadir
            </Button>
          </div>

          {/* Lista de horarios */}
          {horarios.length > 0 && (
            <ul className="text-sm text-white space-y-2 border-t border-zinc-700 pt-2">
              {horarios.map((h, i) => (
                <li key={i} className="flex justify-between items-center border-b border-zinc-800 pb-1">
                  <span>
                    {h.dia}: {h.horaInicio} → {h.horaFin} ·{" "}
                    <span className="font-bold text-emerald-200">
                      {calcularDuracion(h.horaInicio, h.horaFin)}h
                    </span>
                  </span>
                  <button
                    onClick={() => handleEliminar(h.dia, h.horaInicio)}
                    className="text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
