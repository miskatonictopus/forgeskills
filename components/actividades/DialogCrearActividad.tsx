"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { useSnapshot } from "valtio";
import { añadirActividad } from "@/store/actividadesPorCurso";
import { Bot, FileUp, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { CEDetectedList } from "@/components/CEDetectedList";

type Horario = { diaSemana: any; horaInicio: string; horaFin: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  asignaturaNombre?: string;
};

const NOMBRE_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/* ================= Helpers ================= */

// YYYY-MM-DD local (sin UTC)
const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// mapea texto (“jue”, “jueves”) → 0..6
const mapTextoADia = (s: string): number | null => {
  const t = s.toLowerCase().trim();
  const tabla: Record<string, number> = {
    dom: 0, domingo: 0,
    lun: 1, lunes: 1,
    mar: 2, martes: 2,
    mie: 3, "mié": 3, miercoles: 3, miércoles: 3,
    jue: 4, jueves: 4,
    vie: 5, viernes: 5,
    sab: 6, "sáb": 6, sabado: 6, sábado: 6,
  };
  return (t in tabla) ? tabla[t] : null;
};

// Prueba varias convenciones y elige la que da más laborables (1..5)
const normalizaDias = (rawVals: any[]): Set<number> => {
  const textMapped: number[] = [];
  for (const v of rawVals) {
    if (typeof v === "string" && isNaN(Number(v))) {
      const d = mapTextoADia(v);
      if (d !== null) textMapped.push(d);
    }
  }
  if (textMapped.length > 0) return new Set(textMapped);

  const nums = rawVals
    .map((v) => Number(String(v).trim()))
    .filter((n) => !Number.isNaN(n));

  const candA = new Set(nums.map((n) => { // JS: 0..6 (Dom..Sáb)
    if (n >= 0 && n <= 6) return n;
    if (n >= 1 && n <= 7) return n % 7;
    return NaN;
  }).filter((x) => !Number.isNaN(x)));

  const candB = new Set(nums.map((n) => { // Lunes=0..Dom=6 → JS: (n+1)%7
    if (n >= 0 && n <= 6) return (n + 1) % 7;
    return NaN;
  }).filter((x) => !Number.isNaN(x)));

  const candC = new Set(nums.map((n) => { // ISO 1..7 (Lu..Do) → n%7
    if (n >= 1 && n <= 7) return n % 7;
    return NaN;
  }).filter((x) => !Number.isNaN(x)));

  const score = (set: Set<number>) => {
    const weekdays = [...set].filter((d) => d >= 1 && d <= 5).length;
    return weekdays * 10 + set.size;
  };

  const candidates = [candA, candB, candC].sort((a, b) => score(b) - score(a));
  return candidates[0];
};

// Para chips coherentes con la normalización elegida
const toDisplayDay = (raw: any, diasPermitidos: Set<number>): number | null => {
  const txt = typeof raw === "string" && isNaN(Number(raw)) ? mapTextoADia(raw) : null;
  if (txt !== null) return txt;

  const n = Number(String(raw).trim());
  if (Number.isNaN(n)) return null;

  const candidates = new Set<number>();
  if (n >= 0 && n <= 6) candidates.add(n);               // JS 0..6
  if (n >= 1 && n <= 7) candidates.add(n % 7);           // ISO 1..7
  if (n >= 0 && n <= 6) candidates.add((n + 1) % 7);     // lunes=0

  for (const d of candidates) if (diasPermitidos.has(d)) return d;
  return candidates.values().next().value ?? null;
};

/* ================= Componente ================= */

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdExterna,
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

  const [horarios, setHorarios] = useState<Horario[]>([]);

  // Set final de días permitidos (0=Dom .. 6=Sáb)
  const diasPermitidos = useMemo(() => {
    // si desde IPC ya normalizas, puedes sustituir esto por un simple Set(h.diaSemana)
    const raw = horarios.map((h) => (h as any).diaSemana);
    const set = normalizaDias(raw);
    return set.size > 0 ? set : new Set<number>(); // vacío => no restringimos
  }, [horarios]);

  const deshabilitarNoPermitidos = useCallback(
    (day: Date) => (diasPermitidos.size === 0 ? false : !diasPermitidos.has(day.getDay())),
    [diasPermitidos]
  );

  useEffect(() => {
    if (open && asignaturaIdExterna) setAsignaturaId(asignaturaIdExterna);
  }, [open, asignaturaIdExterna]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        if (!open || !cursoId || !asignaturaId) {
          setHorarios([]);
          return;
        }
        const rows = await window.electronAPI.getHorariosAsignatura(cursoId, asignaturaId);
        if (!activo) return;
        setHorarios(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error("Error cargando horarios:", e);
        setHorarios([]);
      }
    })();
    return () => { activo = false; };
  }, [open, cursoId, asignaturaId]);

  const handleGuardar = async () => {
    if (!nombre || !fecha || !asignaturaId || !fechaObj) {
      toast.error("Por favor, completa todos los campos.");
      return;
    }
    // Valida con el Date real (evita TZ issues)
    if (diasPermitidos.size > 0) {
      const day = fechaObj.getDay();
      if (!diasPermitidos.has(day)) {
        toast.error("La fecha seleccionada no coincide con el horario de la asignatura.");
        return;
      }
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha, // YYYY-MM-DD local
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
      setFechaObj(undefined);
      setAsignaturaId(asignaturaIdExterna || "");
      setDescripcion("");
      setArchivo(null);
      setCesDetectados([]);
      setHorarios([]);
      setRefreshKey((k) => k + 1);
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

  const asignaturaNombre =
    asignaturas.find((a) => a.id === asignaturaId)?.nombre || "";

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

          <div className="flex flex-col">
            <Label className="mb-2">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                    setFecha(date ? ymdLocal(date) : ""); // << sin UTC
                  }}
                  disabled={deshabilitarNoPermitidos}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Ayuda visual: días permitidos normalizados */}
            {horarios.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
                {Array.from(diasPermitidos).sort().map((d) => (
                  <span key={d} className="rounded-full border px-2 py-0.5">
                    {NOMBRE_DIA[d]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No hay horario registrado: se permiten todos los días.
              </p>
            )}
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
            <div className="mt-4">
              <CEDetectedList results={cesDetectados} />
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
