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
  /** En calendario global pueden venir vacíos y se pedirán en el propio diálogo */
  cursoId?: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  asignaturaNombre?: string;
  /** Fecha a preseleccionar cuando se abre desde el calendario */
  fechaInicial?: Date;
};

const NOMBRE_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdProp,
  fechaInicial,
}: Props) {
  // ======= estado base =======
  const [fechaObj, setFechaObj] = useState<Date | undefined>(undefined);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ======= contexto (cursos / asignaturas cuando no llegan por props) =======
  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(asignaturaIdProp);

  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [asigsDeCurso, setAsigsDeCurso] = useState<Array<{ id: string; nombre: string }>>([]);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;

  // ======= horarios y días permitidos =======
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const diasPermitidos = useMemo(() => {
    const set = new Set<number>();
    for (const h of horarios) {
      if (typeof h.diaSemana === "number" && h.diaSemana >= 0 && h.diaSemana <= 6) set.add(h.diaSemana);
    }
    return set; // si vacío, no restringimos
  }, [horarios]);

  const deshabilitarNoPermitidos = useCallback(
    (day: Date) => (diasPermitidos.size === 0 ? false : !diasPermitidos.has(day.getDay())),
    [diasPermitidos]
  );

  // ======= Snapshot del store (solo para pintar el nombre si llega por props) =======
  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? (snap[cursoIdEf] || []) : [];
  const asignaturaNombre =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";

  // ======= efectos =======
  // Preselección de fecha y reseteo de selects al abrir
  useEffect(() => {
    if (!open) return;

    if (fechaInicial) {
      setFechaObj(fechaInicial);
      setFecha(fechaInicial.toISOString().split("T")[0]);
    }

    // si no llega curso por props, cargamos lista de cursos
    (async () => {
      if (!cursoId) {
        try {
          const cs = await window.electronAPI.leerCursos();
          setCursos(cs || []);
        } catch (e) {
          console.error(e);
        }
      } else {
        setCursoIdLocal(cursoId);
      }
    })();

    // si llega asignatura por props, set local
    setAsignaturaIdLocal(asignaturaIdProp);

    // limpieza al cerrar
    return () => {
      if (!open) {
        setArchivo(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cargar asignaturas cuando haya curso efectivo
  useEffect(() => {
    (async () => {
      const cId = cursoIdEf;
      if (!cId) {
        setAsigsDeCurso([]);
        return;
      }
      try {
        const asigs = await window.electronAPI.asignaturasDeCurso(cId);
        setAsigsDeCurso(asigs || []);
      } catch (e) {
        console.error(e);
        setAsigsDeCurso([]);
      }
    })();
  }, [cursoIdEf]);

  // Cargar horarios cuando haya curso + asignatura efectiva
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        if (!cursoIdEf || !asignaturaIdEf) {
          setHorarios([]);
          return;
        }
        const rows = await window.electronAPI.getHorariosAsignatura(cursoIdEf, asignaturaIdEf);
        if (!activo) return;
        setHorarios(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error("Error cargando horarios:", e);
        setHorarios([]);
      }
    })();
    return () => {
      activo = false;
    };
  }, [cursoIdEf, asignaturaIdEf]);

  // ======= acciones =======
  const handleGuardar = async () => {
    if (!nombre || !fecha) {
      toast.error("Por favor, completa nombre y fecha.");
      return;
    }
    if (!cursoIdEf || !asignaturaIdEf) {
      toast.error("Selecciona curso y asignatura.");
      return;
    }
    // Validación de día conforme a horario (si lo hay)
    if (diasPermitidos.size > 0) {
      const d = new Date(fecha);
      if (!diasPermitidos.has(d.getDay())) {
        toast.error("La fecha seleccionada no coincide con el horario de la asignatura.");
        return;
      }
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha,
      cursoId: cursoIdEf,
      asignaturaId: asignaturaIdEf,
      descripcion,
    };

    try {
      await window.electronAPI.guardarActividad(nuevaActividad as any);
      añadirActividad(cursoIdEf, nuevaActividad as any);
      toast.success("Actividad guardada correctamente.");

      onOpenChange(false);
      // reset
      setNombre("");
      setFecha("");
      setFechaObj(undefined);
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
    setDescripcion(texto);
    const ceDetectados = await window.electronAPI.analizarDescripcionDesdeTexto(texto, asignaturaIdEf);
    if (!ceDetectados || ceDetectados.length === 0) {
      toast.warning("No se han detectado CE relevantes.");
    } else {
      toast.success(`🎯 ${ceDetectados.length} CE detectados automáticamente.`);
      setCesDetectados(ceDetectados);
    }
  };

  // ======= render =======
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-light">
            Crear nueva actividad
            {asignaturaNombre && cursoIdEf && asignaturaIdEf && (
              <>
                {" "}para<br />
                <p className="font-bold mt-2">{asignaturaNombre}</p>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Separator className="my-3" />

        <div className="space-y-4">
          {/* Cuando faltan curso/asignatura, pedimos selección */}
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
                    setFecha(date ? date.toISOString().split("T")[0] : "");
                  }}
                  disabled={deshabilitarNoPermitidos}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Chips de horario */}
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
                {asignaturaIdEf ? "No hay horario registrado: se permiten todos los días." : "Selecciona curso y asignatura para aplicar restricciones de día."}
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

          <Button className="w-full mt-4" onClick={handleGuardar}>
            <Bot className="w-4 h-4 mr-2" /> Guardar actividad
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
