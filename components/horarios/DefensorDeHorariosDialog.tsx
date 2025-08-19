// components/horarios/DefensorDeHorariosDialog.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, addMinutes, isBefore } from "date-fns";

type Horario = { diaSemana: number; horaInicio: string; horaFin: string };

export type SlotSeleccionado = { startISO: string; endISO: string };
export type DefensorParams = {
  cursoId: string;
  asignaturaId?: string | null;
  duracionMin: number;
  stepMinutes?: number;
  initial?: Date | null;
};

// 🔑 Mapeo de texto en BDD → número getDay() JS
// 🔑 Mapeo robusto TEXT → getDay() con diagnóstico
function diaTextoToJsDay(dia: unknown): number {
  if (dia == null) return -1;

  let s = String(dia).trim();
  // normaliza acentos y mayúsculas
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {}
  s = s.toLowerCase();

  // soporta castellano completo y abreviaturas
  const map: Record<string, number> = {
    domingo: 0, dom: 0,
    lunes: 1,   lun: 1,
    martes: 2,  mar: 2,
    miercoles: 3, mie: 3, mier: 3,
    jueves: 4,  jue: 4,
    viernes: 5, vie: 5,
    sabado: 6,  sab: 6,
  };

  if (s in map) return map[s];

  // números: "0..6" (JS) o "1..7" (Lun..Dom)
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n >= 0 && n <= 6) return n;           // 0=Dom..6=Sab
    if (n >= 1 && n <= 7) return n === 7 ? 0 : n; // 1=Lun..7=Dom
  }

  console.warn("[Defensor] Dia no reconocido:", dia);
  return -1;
}


// Helpers locales
const ymdLocal = (d: Date) => format(d, "yyyy-MM-dd");
const hoyLocal = () => ymdLocal(new Date());

export function DefensorDeHorariosDialog({
  open,
  onOpenChange,
  params,
  onSelect,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  params: DefensorParams;
  onSelect: (slot: SlotSeleccionado) => void;
  onCancel: () => void;
}) {
  const { cursoId, asignaturaId, duracionMin, stepMinutes = 15, initial } = params;
  const [lectivo, setLectivo] = useState<{ start?: string; end?: string } | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [date, setDate] = useState<Date | undefined>(initial ?? new Date());
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  // Cargar rango lectivo
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await window.electronAPI.leerRangoLectivo();
        setLectivo(r || null);
      } catch {
        setLectivo(null);
      }
    })();
  }, [open]);

  // Cargar horarios de la asignatura
  useEffect(() => {
    let activo = true;
    (async () => {
      if (!open || !cursoId || !asignaturaId) {
        if (activo) setHorarios([]);
        return;
      }
      try {
        const rows = await window.electronAPI.getHorariosAsignatura(cursoId, asignaturaId);
  
        console.log("[Defensor] rows crudos:", rows);
  
        if (!activo) return;
  
        const mapped: Horario[] = Array.isArray(rows)
          ? rows
              .map((r: any) => ({
                // ⚠️ en tu tabla el campo es 'dia' (TEXT)
                diaSemana: diaTextoToJsDay(r.dia ?? r.diaSemana ?? r.dia_semana ?? r.weekday ?? r.dow),
                horaInicio: String(r.horaInicio ?? r.hora_inicio ?? r.inicio ?? r.start ?? ""),
                horaFin: String(r.horaFin ?? r.hora_fin ?? r.fin ?? r.end ?? ""),
              }))
              .filter(
                (h) =>
                  h.diaSemana >= 0 &&
                  h.diaSemana <= 6 &&
                  h.horaInicio.length >= 4 &&
                  h.horaFin.length >= 4
              )
          : [];
  
        console.log("[Defensor] horarios mapeados:", mapped);
        if (activo) setHorarios(mapped);
      } catch (e) {
        console.error("Error cargando horarios:", e);
        if (activo) setHorarios([]);
      }
    })();
    return () => {
      activo = false;
    };
  }, [open, cursoId, asignaturaId]);

  // Set de días permitidos según horarios
  const diasPermitidos = useMemo(() => {
    const set = new Set<number>();
    for (const h of horarios) set.add(h.diaSemana);
    return set;
  }, [horarios]);
  
  const deshabilitarNoPermitidos = useCallback(
    (day: Date) => {
      const ymd = format(day, "yyyy-MM-dd");
      // rango lectivo
      if (lectivo?.start && lectivo?.end) {
        if (ymd < lectivo.start || ymd > lectivo.end) return true;
      }
      // ⛔ si no hay horario, deshabilita todo
      if (!horarios.length) return true;
      // sólo permitir días presentes en horarios (getDay(): 0..6)
      return !diasPermitidos.has(day.getDay());
    },
    [lectivo?.start, lectivo?.end, diasPermitidos, horarios.length]
  );



  // Generar slots válidos del día seleccionado según horarios
  const slots = useMemo(() => {
    if (!date) return [];
    const day = date.getDay();

    // Filtrar solo franjas del día seleccionado
    const franjas = horarios.filter((h) => h.diaSemana === day);
    if (!franjas.length) return [];

    const res: Date[] = [];
    for (const f of franjas) {
      const [hiH, hiM] = f.horaInicio.split(":").map(Number);
      const [hfH, hfM] = f.horaFin.split(":").map(Number);
      const inicio = new Date(date);
      inicio.setHours(hiH, hiM, 0, 0);
      const fin = new Date(date);
      fin.setHours(hfH, hfM, 0, 0);

      for (
        let t = new Date(inicio);
        !isBefore(fin, addMinutes(t, duracionMin));
        t = addMinutes(t, stepMinutes)
      ) {
        if (ymdLocal(t) === hoyLocal() && isBefore(t, new Date())) continue;
        res.push(new Date(t));
      }
    }
    return res.sort((a, b) => a.getTime() - b.getTime());
  }, [date, horarios, duracionMin, stepMinutes]);

  const fromDate = lectivo?.start ? new Date(lectivo.start + "T00:00:00") : undefined;
  const toDate = lectivo?.end ? new Date(lectivo.end + "T23:59:59") : undefined;

  const handleConfirm = () => {
    if (!selectedStart) return;
    const startISO = format(selectedStart, "yyyy-MM-dd'T'HH:mm");
    const endISO = format(addMinutes(selectedStart, duracionMin), "yyyy-MM-dd'T'HH:mm");
    onSelect({ startISO, endISO });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(95vw,800px)] sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Selecciona fecha y hora</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="border rounded-md">
  <Calendar
    mode="single"
    selected={date}
    onSelect={(d) => {
      setDate(d ?? undefined);
      setSelectedStart(null);
    }}
    disabled={deshabilitarNoPermitidos}
    fromDate={fromDate}
    toDate={toDate}
    initialFocus
    showOutsideDays={false}
  />

  {/* Chips de diagnóstico: qué días están permitidos */}
  {horarios.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground px-3 pb-3">
      {Array.from(new Set(horarios.map(h => h.diaSemana)))
        .sort((a,b)=>a-b)
        .map((d) => (
          <span key={d} className="rounded-full border px-2 py-0.5">
            {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d]}
          </span>
        ))}
    </div>
  )}
</div>

          <div className="grid gap-2 max-h-[360px] overflow-y-auto border rounded-md p-2">
            {!horarios.length ? (
              <div className="text-sm text-muted-foreground p-2">
                Esta asignatura no tiene horario registrado. No se pueden proponer huecos.
              </div>
            ) : date && slots.length > 0 ? (
              slots.map((s) => {
                const label = format(s, "HH:mm");
                const isSel = !!(selectedStart && s.getTime() === selectedStart.getTime());
                return (
                  <Button
                    key={s.toISOString()}
                    variant={isSel ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setSelectedStart(s)}
                  >
                    {label}
                  </Button>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground p-2">
                {date ? "No hay huecos disponibles para este día." : "Elige un día en el calendario."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedStart}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
