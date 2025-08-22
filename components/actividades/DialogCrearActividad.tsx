"use client";

import { useEffect, useState } from "react";
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
import { Bot, FileUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { CEDetectedList } from "@/components/CEDetectedList";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId?: string;
  setRefreshKey?: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  asignaturaNombre?: string;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdProp,
  asignaturaNombre,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [descripcionHtml, setDescripcionHtml] = useState<string>("");
  const [descripcionPlain, setDescripcionPlain] = useState<string>("");

  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(asignaturaIdProp);

  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [asigsDeCurso, setAsigsDeCurso] = useState<Array<{ id: string; nombre: string }>>([]);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;

  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? (snap[cursoIdEf] || []) : [];
  const asignaturaNombreFromStore =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";

  const asignaturaNombreEf = asignaturaNombre ?? asignaturaNombreFromStore;

  useEffect(() => {
    if (!open) return;
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

  // ================== GUARDAR ==================
  const handleGuardar = async () => {
    if (!nombre) {
      toast.error("Por favor, completa el nombre.");
      return;
    }
    if (!cursoIdEf || !asignaturaIdEf) {
      toast.error("Selecciona curso y asignatura.");
      return;
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha: new Date().toISOString().slice(0, 10), // 👈 fecha automática de creación
      cursoId: cursoIdEf,
      asignaturaId: asignaturaIdEf,
      descripcion,
      estado: "borrador",
    };

    try {
      setLoading(true);
      const raw = await window.electronAPI.guardarActividad(nuevaActividad as any);
      const res = (raw ?? {}) as { ok?: boolean; error?: string };

      if (!res.ok) {
        toast.error(`No se guardó: ${res?.error ?? "Error desconocido"}`);
        return;
      }

      añadirActividad(cursoIdEf, nuevaActividad as any);
      toast.success("Actividad guardada correctamente.");

      // reset
      onOpenChange(false);
      setNombre("");
      setDescripcion("");
      setArchivo(null);
      setCesDetectados([]);
      setRefreshKey?.((k) => k + 1);
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

    const html = `<p>${texto
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((p) =>
        p.trim().length ? p.trim().replace(/\n/g, "<br/>") : "<br/>"
      )
      .join("</p><p>")}</p>`;

    setDescripcionHtml(html);
    setDescripcion(html);
    setDescripcionPlain(texto);

    const ceDetectados = await window.electronAPI.analizarDescripcionDesdeTexto(
      texto,
      asignaturaIdEf
    );
    if (!ceDetectados || ceDetectados.length === 0) {
      toast.warning("No se han detectado CE relevantes.");
    } else {
      toast.success(`🎯 ${ceDetectados.length} CE detectados automáticamente.`);
      setCesDetectados(ceDetectados);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(95vw,1000px)] sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-bold">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-1"
            >
              <div className="flex items-baseline gap-2">
  <motion.p variants={itemVariants}>Creando Actividad para</motion.p>
  {asignaturaNombreEf && (
    <motion.p variants={itemVariants} className="font-bold">
      {asignaturaNombreEf}
    </motion.p>
  )}
</div>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <Separator className="my-3" />

        <div className="space-y-4">
          {/* Curso + Asignatura en la misma fila */}
          {(!cursoId || !asignaturaIdProp) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                          {c.id} - {c.nombre}
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
                      <SelectValue
                        placeholder={
                          cursoIdEf ? "Selecciona asignatura" : "Elige antes un curso"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {asigsDeCurso.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.id} - {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Nombre */}
          <div>
            <Label className="mb-2">Nombre de la actividad</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Práctica 1"
            />
          </div>

          {/* Descripción */}
          <div>
            <Label className="mb-2">Descripción de la actividad</Label>
            <TiptapEditor
              valueHtml={descripcionHtml}
              onChange={(html, plain) => {
                setDescripcionHtml(html);
                setDescripcionPlain(plain);
                setDescripcion(html);
              }}
              className="w-full tiptap ProseMirror border border-zinc-700 rounded-md p-4 min-h-[200px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Archivo */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
  {/* Izquierda: subir archivo + tipos permitidos */}
  <div className="flex items-center gap-3 min-w-0">
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

    {/* Botón subir archivo */}
    <Button asChild variant="secondary" className="gap-2">
      <label htmlFor="archivo">
        <FileUp className="w-4 h-4" />
        Subir archivo
      </label>
    </Button>

    {/* Texto de archivos permitidos */}
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      archivos permitidos: PDF / Pages / Word / txt
    </span>

    {archivo && (
      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
        {archivo.name}
      </span>
    )}
  </div>

  {/* Derecha: guardar */}
  <Button onClick={handleGuardar} disabled={loading} className="px-6">
    <Bot className="w-4 h-4 mr-2" />
    {loading ? "Guardando..." : "Guardar actividad"}
  </Button>
</div>
</div>
      </DialogContent>
    </Dialog>
  );
}
