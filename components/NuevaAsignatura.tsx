"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };
type Descripcion = { duracion?: string; centro?: string | null; empresa?: string | null };

type AsignaturaRemota = {
  id: string;
  nombre: string;
  creditos?: string;
  descripcion?: Descripcion;
  RA: RA[];
  CE?: any[];
};

type Props = { cursoId: string; onSave?: () => void };

export default function NuevaAsignatura({ cursoId, onSave }: Props) {
  const [asignaturasRemotas, setAsignaturasRemotas] = useState<AsignaturaRemota[]>([]);
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState<AsignaturaRemota | null>(null);
  const [horarios, setHorarios] = useState<
    { dia: string; horaInicio: string; horaFin: string }[]
  >([]);

  /* ================== Cargar asignaturas remotas ================== */
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/miskatonictopus/asignaturas_fp/refs/heads/main/asignaturas_FP.json")
      .then((res) => res.json())
      .then((data: AsignaturaRemota[]) => setAsignaturasRemotas(data ?? []))
      .catch((err) => {
        toast.error("Error al cargar asignaturas remotas");
        console.error(err);
      });
  }, []);

  const keyFor = (a: AsignaturaRemota) => `${a.id}::${a.nombre.trim().toLowerCase()}`;
  const score = (x: AsignaturaRemota) =>
    (x.RA?.length ?? 0) + (x.RA?.reduce((acc, r) => acc + (r.CE?.length ?? 0), 0) ?? 0);

  const asignaturasUnicas = useMemo(() => {
    const map = new Map<string, AsignaturaRemota>();
    for (const a of asignaturasRemotas) {
      const k = keyFor(a);
      const prev = map.get(k);
      if (!prev || score(a) > score(prev)) {
        map.set(k, a);
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [asignaturasRemotas]);

  /* ================== Guardar asignatura + horarios ================== */
  const handleGuardarAsignatura = async () => {
    if (!asignaturaSeleccionada) {
      toast.error("Selecciona una asignatura");
      return;
    }
    try {
      // Guardar la asignatura
      await window.electronAPI.guardarAsignatura(asignaturaSeleccionada);
      toast.success("Asignatura guardada en la base de datos");

      // Guardar horarios si los hay
      if (horarios.length > 0) {
        for (const h of horarios) {
          await window.electronAPI.guardarHorario({
            cursoId,
            asignaturaId: asignaturaSeleccionada.id,
            dia: h.dia,
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
          });
        }
        toast.success("Horarios guardados");
      }

      onSave?.(); // 🔄 dispara el refresco global y cierra el dialog
    } catch (error) {
      toast.error("Error al guardar la asignatura");
      console.error(error);
    }
  };

  /* ================== Helpers horarios ================== */
  const addHorario = () => {
    setHorarios([...horarios, { dia: "lunes", horaInicio: "08:00", horaFin: "09:00" }]);
  };

  const updateHorario = (i: number, field: string, value: string) => {
    const copy = [...horarios];
    (copy[i] as any)[field] = value;
    setHorarios(copy);
  };

  /* ================== Render ================== */
  return (
    <div className="space-y-4">
      {/* Selector asignatura */}
      <div>
        <Label htmlFor="asignatura">Asignatura</Label>
        <Select onValueChange={(value) => {
          const [id, nombre] = value.split("::");
          const sel = asignaturasUnicas.find((a) => a.id === id && a.nombre === nombre) || null;
          setAsignaturaSeleccionada(sel);
        }}>
          <SelectTrigger id="asignatura">
            <SelectValue placeholder="Selecciona una asignatura" />
          </SelectTrigger>
          <SelectContent>
            {[...asignaturasUnicas]
              .sort((a, b) => parseInt(a.id) - parseInt(b.id))
              .map((asig) => (
                <SelectItem
                  key={`${asig.id}-${asig.nombre}`}
                  value={`${asig.id}::${asig.nombre}`}
                >
                  {asig.id} – {asig.nombre}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Horarios */}
      <div className="space-y-2">
        <Label>Horarios</Label>
        {horarios.map((h, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select value={h.dia} onValueChange={(v) => updateHorario(i, "dia", v)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["lunes","martes","miércoles","jueves","viernes"].map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="time"
              value={h.horaInicio}
              onChange={(e) => updateHorario(i, "horaInicio", e.target.value)}
            />
            <Input
              type="time"
              value={h.horaFin}
              onChange={(e) => updateHorario(i, "horaFin", e.target.value)}
            />
          </div>
        ))}
        <Button variant="outline" onClick={addHorario}>+ Añadir horario</Button>
      </div>

      <Button onClick={handleGuardarAsignatura}>Guardar Asignatura + Horarios</Button>
    </div>
  );
}
