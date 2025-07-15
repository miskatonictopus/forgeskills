"use client";

import { useState } from "react";
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

function calcularTotalHoras(horarios: Horario[]): number {
  return horarios.reduce(
    (total, h) => total + calcularDuracion(h.horaInicio, h.horaFin),
    0
  );
}

function calcularDuracion(inicio: string, fin: string): number {
  const [hInicio, mInicio] = inicio.split(":").map(Number);
  const [hFin, mFin] = fin.split(":").map(Number);

  const inicioMin = hInicio * 60 + mInicio;
  const finMin = hFin * 60 + mFin;

  return (finMin - inicioMin) / 60; // devuelve horas como número (p.ej. 1.5)
}

type Horario = {
  dia: string;
  horaInicio: string;
  horaFin: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  asignatura: { id: string; nombre: string };
  onGuardar: (
    asignaturaId: string,
    horarios: { dia: string; horaInicio: string; horaFin: string }[]
  ) => void;
};

export function HorarioDialog({ open, onClose, asignatura, onGuardar }: Props) {
  const [dia, setDia] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [horarios, setHorarios] = useState<
    { dia: string; horaInicio: string; horaFin: string }[]
  >([]);

  const handleAñadir = () => {
    if (!dia || !horaInicio || !horaFin) return;
    setHorarios((prev) => [...prev, { dia, horaInicio, horaFin }]);
    setDia("");
    setHoraInicio("");
    setHoraFin("");
  };

  const handleEliminar = (index: number) => {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGuardar = () => {
    onGuardar(asignatura.id, horarios);
    setHorarios([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 text-white">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Insertar horario para {asignatura.id}</DialogTitle>
            <span className="text-emerald-200 text-4xl font-bold mr-4 whitespace-nowrap">
              {calcularTotalHoras(horarios)}h
            </span>
          </div>
          <DialogDescription className="text-zinc-400 uppercase">
            {asignatura.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* 👇 Inputs agrupados horizontalmente */}
          <div className="flex w-full gap-4 items-end">
            {/* Día de la semana - 1/2 */}
            <div className="w-1/2 space-y-1">
              <Label className="mb-2">Día de la semana</Label>
              <Select value={dia} onValueChange={setDia}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un día" />
                </SelectTrigger>
                <SelectContent>
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map(
                    (d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/4 space-y-1">
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

            <div className="w-1/4 space-y-1">
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

            {/* ➕ Botón de añadir */}
            <Button onClick={handleAñadir} variant="secondary">
              Añadir
            </Button>
          </div>

          {/* 🧾 Lista de horarios añadidos */}
          {horarios.length > 0 && (
            <ul className="text-sm text-white space-y-2 border-t border-zinc-700 pt-2">
              {horarios.map((h, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center border-b border-zinc-800 pb-1"
                >
                  <span>
                    {h.dia}: {h.horaInicio} → {h.horaFin} ·{" "}
                    <span className="font-bold text-emerald-200">
                      {calcularDuracion(h.horaInicio, h.horaFin)}h
                    </span>
                  </span>
                  <button
                    onClick={() => handleEliminar(i)}
                    className="text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button className="w-full mt-2" onClick={handleGuardar}>
            Guardar horario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
