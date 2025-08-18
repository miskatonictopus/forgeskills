"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";
const TiptapEditor = dynamic(() => import("@/components/TiptapEditor"), { ssr: false });
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type Horario = { diaSemana: number; horaInicio: string; horaFin: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId?: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  fechaInicial?: Date;
  asignaturaNombre?: string;
  cursoIdEf?: string;
  asignaturaIdEf?: string;
};

const NOMBRE_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ymdLocal = (d: Date) => format(d, "yyyy-MM-dd");
const hoyLocal = () => ymdLocal(new Date());

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdProp,
  fechaInicial,
}: Props) {
  const [fechaObj, setFechaObj] = useState<Date | undefined>(undefined);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lectivo, setLectivo] = useState<{ start?: string; end?: string } | null>(null);
  const [descripcionHtml, setDescripcionHtml] = useState<string>("");
const [descripcionPlain, setDescripcionPlain] = useState<string>("");

  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(asignaturaIdProp);

  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [asigsDeCurso, setAsigsDeCurso] = useState<Array<{ id: string; nombre: string }>>([]);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;

  const [horarios, setHorarios] = useState<Horario[]>([]);
  const diasPermitidos = useMemo(() => {
    const set = new Set<number>();
    for (const h of horarios) {
      if (typeof h.diaSemana === "number" && h.diaSemana >= 0 && h.diaSemana <= 6) set.add(h.diaSemana);
    }
    return set;
  }, [horarios]);

  const deshabilitarNoPermitidos = useCallback(
    (day: Date) => {
      const ymd = ymdLocal(day);
      const hoy = hoyLocal();
      if (ymd < hoy) return true;
      if (lectivo?.start && lectivo?.end) {
        if (ymd < lectivo.start || ymd > lectivo.end) return true;
      }
      if (diasPermitidos.size > 0 && !diasPermitidos.has(day.getDay())) return true;
      return false;
    },
    [lectivo?.start, lectivo?.end, diasPermitidos]
  );

  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? (snap[cursoIdEf] || []) : [];
  const asignaturaNombre =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";

  useEffect(() => {
    if (!open) return;
    if (fechaInicial) {
      setFechaObj(fechaInicial);
      setFecha(ymdLocal(fechaInicial));
    }
    (async () => {
      try {
        const r = await window.electronAPI.leerRangoLectivo();
        setLectivo(r || null);
      } catch {
        setLectivo(null);
      }
    })();
    (async () => {
      if (!cursoId) {
        try {
          const cs = await window.electronAPI.leerCursos();
          setCursos(cs || []);
        } catch {}
      } else {
        setCursoIdLocal(cursoId);
      }
    })();
    setAsignaturaIdLocal(asignaturaIdProp);
    return () => {
      if (!open) setArchivo(null);
    };
  }, [open]);

  useEffect(() => {
    (async () => {
      if (!cursoIdEf) return setAsigsDeCurso([]);
      const asigs = await window.electronAPI.asignaturasDeCurso(cursoIdEf);
      setAsigsDeCurso(asigs || []);
    })();
  }, [cursoIdEf]);
  useEffect(() => {
    let activo = true;
    (async () => {
      if (!open) return;
      if (!cursoIdEf || !asignaturaIdEf) {
        if (activo) setHorarios([]);
        return;
      }
      try {
        const rows = await window.electronAPI.getHorariosAsignatura(cursoIdEf, asignaturaIdEf);
        if (!activo) return;
        const mapped = Array.isArray(rows)
          ? rows
              .map((r: any) => ({
                diaSemana: Number(r.diaSemana ?? r.dia_semana ?? r.dia ?? r.weekday ?? r.dow),
                horaInicio: r.horaInicio ?? r.hora_inicio ?? r.inicio ?? r.start,
                horaFin: r.horaFin ?? r.hora_fin ?? r.fin ?? r.end,
              }))
              .filter(h =>
                Number.isFinite(h.diaSemana) &&
                h.diaSemana >= 0 && h.diaSemana <= 6 &&
                typeof h.horaInicio === "string" &&
                typeof h.horaFin === "string"
              )
          : [];
        setHorarios(mapped);
      } catch (e) {
        console.error("Error cargando horarios:", e);
        if (activo) setHorarios([]);
      }
    })();
    return () => { activo = false; };
  }, [open, cursoIdEf, asignaturaIdEf]);
  

  // ================== GUARDAR (con respuesta ok/error) ==================
  const handleGuardar = async () => {
    const hoy = hoyLocal();
    
    if (!nombre || !fecha) {
      toast.error("Por favor, completa nombre y fecha.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      toast.error(`Formato de fecha inválido: ${fecha}`);
      return;
    }
    if (fecha < hoy) {
      toast.error("No puedes crear actividades en fechas pasadas.");
      return;
    }
    if (lectivo?.start && lectivo?.end) {
      if (fecha < lectivo.start || fecha > lectivo.end) {
        toast.error("La fecha seleccionada está fuera del periodo lectivo.");
        return;
      }
    }
    if (!cursoIdEf || !asignaturaIdEf) {
      toast.error("Selecciona curso y asignatura.");
      return;
    }
    if (diasPermitidos.size > 0 && fechaObj && !diasPermitidos.has(fechaObj.getDay())) {
      toast.error("La fecha seleccionada no coincide con un día de clase para esta asignatura.");
      return;
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha, // YYYY-MM-DD
      cursoId: cursoIdEf,
      asignaturaId: asignaturaIdEf,
      descripcion,
    };

    try {
      setLoading(true);
      type GuardarActividadResult = { ok: boolean; error?: string };

// ⚠️ cast defensivo: sirve aunque tu preload siga devolviendo `any` o `void`
const raw = await window.electronAPI.guardarActividad(nuevaActividad as any);
const res = (raw ?? {}) as Partial<GuardarActividadResult>;

if (!res.ok) {
  toast.error(`No se guardó: ${res?.error ?? "Error desconocido"}`);
  return;
}

      añadirActividad(cursoIdEf, nuevaActividad as any);
      toast.success("Actividad guardada correctamente.");

      // reset
      onOpenChange(false);
      setNombre("");
      setFecha("");
      setFechaObj(undefined);
      setDescripcion("");
      setArchivo(null);
      setCesDetectados([]);
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Error al guardar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  const handleExtraerTexto = async (filePath: string) => {
    if (!asignaturaIdEf) {
      toast.warning("Selecciona primero curso y asignatura.");
      return;
    }
    const texto = await window.electronAPI.extraerTextoPDF(filePath);
    const palabras = (texto ?? "").split(/\s+/).filter(Boolean).length;
    if (!texto || palabras < 5) {
      toast.error(`Texto insuficiente: ${palabras} palabras detectadas.`);
      return;
    }
  
    // Renderizamos texto como HTML simple (respetando saltos de línea)
    const html = `<p>${texto
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map(p => p.trim().length ? p.trim().replace(/\n/g, "<br/>") : "<br/>")
      .join("</p><p>")}</p>`;
  
    setDescripcionHtml(html);
    setDescripcion(html);         // BDD
    setDescripcionPlain(texto);   // CE
  
    const ceDetectados = await window.electronAPI.analizarDescripcionDesdeTexto(texto, asignaturaIdEf);
    if (!ceDetectados || ceDetectados.length === 0) {
      toast.warning("No se han detectado CE relevantes.");
    } else {
      toast.success(`🎯 ${ceDetectados.length} CE detectados automáticamente.`);
      setCesDetectados(ceDetectados);
    }
  };
  

  const fromDate = lectivo?.start ? new Date(lectivo.start + "T00:00:00") : undefined;
  const toDate   = lectivo?.end   ? new Date(lectivo.end   + "T23:59:59") : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
  className="w-[min(95vw,1000px)] sm:max-w-[1000px] max-h-[90vh] overflow-y-auto"
>
        <DialogHeader>
        <DialogTitle className="font-bold">
  <p className="animate-fadeInUp">¡Crea una nueva actividad</p>
  <p className="animate-fadeInUp delay-200 text-yellow-300">
    para {asignaturaNombre}!
  </p>
</DialogTitle>

        </DialogHeader>

        <Separator className="my-3" />

        <div className="space-y-4">
          {!cursoId && (
            <div>
              <Label className="mb-2">Curso</Label>
              <Select
                value={cursoIdLocal}
                onValueChange={(v) => {
                  setCursoIdLocal(v);
                  setAsignaturaIdLocal(undefined);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona curso" />
                </SelectTrigger>
                <SelectContent>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!asignaturaIdProp && (
            <div>
              <Label className="mb-2">Asignatura</Label>
              <Select
                disabled={!cursoIdEf}
                value={asignaturaIdLocal}
                onValueChange={setAsignaturaIdLocal}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={cursoIdEf ? "Selecciona asignatura" : "Elige antes un curso"} />
                </SelectTrigger>
                <SelectContent>
                  {asigsDeCurso.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={loading}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fechaObj ? format(fechaObj, "dd/MM/yyyy") : <span>Elige una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaObj}
                  onSelect={(date) => {
                    setFechaObj(date || undefined);
                    setFecha(date ? ymdLocal(date) : "");
                  }}
                  disabled={deshabilitarNoPermitidos}
                  fromDate={fromDate}
                  toDate={toDate}
                  showOutsideDays={false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {horarios.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
                {horarios.map((h, i) => (
                  <span key={i} className="rounded-full border px-2 py-0.5">
                    {NOMBRE_DIA[h.diaSemana]} {h.horaInicio}–{h.horaFin}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {asignaturaIdEf
                  ? "No hay horario registrado: se permiten todos los días."
                  : "Selecciona curso y asignatura para aplicar restricciones de día."}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2">Descripción de la actividad</Label>
            <TiptapEditor
  valueHtml={descripcionHtml}
  onChange={(html, plain) => {
    setDescripcionHtml(html);     // lo que guardaremos en BDD para PDF
    setDescripcionPlain(plain);   // para análisis CE
    setDescripcion(html);         // si tu BDD usa campo 'descripcion' (TEXT) guardamos HTML
  }}
  className="w-full"
/>
          </div>

          <div>
            <Label className="mb-2 flex justify-between items-center w-full">
              O bien sube un archivo
              <span className="text-xs text-neutral-500">
                archivos permitidos:<br />PDF / Pages / Word / txt
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

          <Button className="w-full mt-4" onClick={handleGuardar} disabled={loading}>
            <Bot className="w-4 h-4 mr-2" /> {loading ? "Guardando..." : "Guardar actividad"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
