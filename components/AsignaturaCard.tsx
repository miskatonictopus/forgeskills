"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MensajeSinHorarios } from "@/components/MensajeSinHorarios";
import { SquarePen, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Horario = { dia: string; horaInicio: string; horaFin: string; cursoId?: string };
type Descripcion = { duracion: string; centro: string; empresa: string; creditos?: string | number };
type RA = { codigo: string; descripcion: string; CE: any[] };
type Asignatura = {
  id: string;
  nombre: string;
  creditos?: number | string;
  descripcion: Descripcion;
  RA: RA[];
  color?: string | null;
};

type AsignaturaCardProps = {
  asignatura: Asignatura;
  horarios: Horario[];
  onOpenHorario: (id: string) => void;
  onReload: () => void;
};

/* ====== color helpers ====== */
const DEFAULT_PALETTE = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16",
  "#22c55e","#10b981","#06b6d4","#3b82f6","#6366f1",
  "#8b5cf6","#a855f7","#ec4899","#f43f5e","#14b8a6",
  "#0ea5e9","#0891b2","#e11d48","#dc2626","#059669",
  "#737373","#525252","#111827","#ffffff","#000000",
];
const isValidHex = (v: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test((v || "").trim());
const normalizeHex = (v: string) => {
  let s = (v || "").trim();
  if (!s) return "";
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s.toLowerCase();
};
const hexToRgb = (hex?: string | null): [number, number, number] | null => {
  if (!hex) return null;
  const h = normalizeHex(hex);
  if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};
const isVeryLight = (hex?: string | null) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return L > 0.85;
};
const gradientForCard = (hex?: string | null): string | undefined => {
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  const base = isVeryLight(hex) ? 0.18 : 0.32;
  return `linear-gradient(
    to top,
    rgba(${r},${g},${b}, ${base}) 0%,
    rgba(${r},${g},${b}, ${base * 0.75}) 35%,
    rgba(${r},${g},${b}, ${base * 0.4}) 65%,
    rgba(${r},${g},${b}, 0) 100%
  )`;
};
/* ========================== */

export function AsignaturaCard(props: AsignaturaCardProps) {
  const { asignatura, horarios, onOpenHorario, onReload } = props;

  const [openColor, setOpenColor] = useState(false);
  const [colorActual, setColorActual] = useState<string>(asignatura.color || "");
  const [hexInput, setHexInput] = useState<string>(asignatura.color || "");

  useEffect(() => {
    setColorActual(asignatura.color || "");
    setHexInput(asignatura.color || "");
  }, [asignatura.color]);

  const handleColorChange = async (nuevoColor: string) => {
    try {
      setColorActual(nuevoColor);
      await window.electronAPI.actualizarColorAsignatura(asignatura.id, nuevoColor);

      // notifica a CursoCard y demás
      window.dispatchEvent(
        new CustomEvent("asignatura:color:actualizado", {
          detail: { asignaturaId: asignatura.id, color: nuevoColor },
        })
      );

      toast.success("Color actualizado");
      onReload();
      setOpenColor(false);
    } catch {
      toast.error("Error al guardar el color");
    }
  };

  const handleClearColor = async () => {
    try {
      setColorActual("");
      setHexInput("");
      await window.electronAPI.actualizarColorAsignatura(asignatura.id, "");
      toast.success("Color quitado");
      onReload();
      setOpenColor(false);
    } catch {
      toast.error("No se pudo quitar el color");
    }
  };

  const totalHoras = horarios.reduce((total, h) => {
    const [h1, m1] = h.horaInicio.split(":").map(Number);
    const [h2, m2] = h.horaFin.split(":").map(Number);
    return total + (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  }, 0);

  return (
    <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative overflow-hidden">
      {/* Degradado de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ backgroundImage: gradientForCard(colorActual) }}
      />

      {/* Botones esquina */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        {/* ---- Color Popover ---- */}
        <Tooltip>
          <Popover open={openColor} onOpenChange={setOpenColor}>
            <PopoverTrigger asChild>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-2 text-zinc-300 hover:text-emerald-400 rounded-md px-2 py-1 hover:bg-zinc-800/60"
                  aria-label="Elegir color"
                >
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      isVeryLight(colorActual) ? "border-black/20" : "border-white/20"
                    }`}
                    style={{ backgroundColor: colorActual || "transparent" }}
                  />
                  <SquarePen className="w-4 h-4" />
                </button>
              </TooltipTrigger>
            </PopoverTrigger>

            <PopoverContent className="w-[260px] p-3" align="end">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Color de la asignatura</div>
                {colorActual ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Quitar color"
                    onClick={handleClearColor}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              {/* Paleta */}
              <div role="grid" className="grid grid-cols-8 gap-2">
                {DEFAULT_PALETTE.map((c) => {
                  const selected = colorActual && normalizeHex(colorActual) === normalizeHex(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`relative h-7 w-7 rounded-full border transition
                        ${isVeryLight(c) ? "border-black/20" : "border-white/20"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => handleColorChange(c)}
                    >
                      {selected && (
                        <Check
                          className={`absolute inset-0 m-auto h-4 w-4 ${
                            isVeryLight(c) ? "text-black/70" : "text-white"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* HEX manual */}
              <div className="mt-3 space-y-2">
                <label className="text-xs text-muted-foreground">Código HEX</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={hexInput}
                    onChange={(e) => setHexInput(e.target.value)}
                    placeholder="#3b82f6"
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (!hexInput || isValidHex(hexInput))) {
                        handleColorChange(hexInput || "");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={() => handleColorChange(hexInput || "")}
                    disabled={!!hexInput && !isValidHex(hexInput)}
                  >
                    Aplicar
                  </Button>
                </div>
                {hexInput && !isValidHex(hexInput) && (
                  <p className="text-[11px] text-red-500">Introduce un HEX válido (p.ej. #aabbcc).</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <TooltipContent side="top">Color</TooltipContent>
        </Tooltip>

        {/* Borrar asignatura */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-zinc-400 hover:text-emerald-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Borrar</TooltipContent>
        </Tooltip>
      </div>

      <CardContent className="leading-tight relative z-10">
        <p className="text-4xl font-bold truncate uppercase">{asignatura.id}</p>
        <p className="text-xs font-light text-zinc-300 uppercase">{asignatura.nombre}</p>

        <div className="flex gap-2 text-xs font-light">
          <p className="text-zinc-300">
            Créditos: <span className="text-white">{asignatura.creditos ?? "—"}</span>
          </p>
          <p className="text-zinc-300">
            Horas: <span className="text-white">{asignatura.descripcion?.duracion}</span>
          </p>
        </div>

        <p className="text-xs font-bold text-white">
          RA: <span className="font-light">{asignatura.RA?.length || 0}</span>
        </p>

        <Separator className="my-4" />
        <div className="pt-2 mt-2 space-y-1 text-xs leading-tight">
          {horarios.length > 0 ? (
            <>
              {horarios.map((h, i) => (
                <div key={`${h.dia}-${h.horaInicio}-${i}`} className="flex items-center gap-2 group text-white">
                  <button
                    onClick={() => onOpenHorario(asignatura.id)}
                    aria-label="Editar horario"
                    className="text-white hover:text-white transition-colors"
                  >
                    <SquarePen className="w-3.5 h-3.5" />
                  </button>

                  {h.cursoId && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] uppercase tracking-wide">
                      {h.cursoId}
                    </span>
                  )}

                  <span className="tabular-nums">
                    {h.dia} {h.horaInicio}–{h.horaFin}
                  </span>
                </div>
              ))}
              <div className="text-xl font-bold text-white">{totalHoras.toFixed(1)} h</div>
            </>
          ) : (
            <div className="text-red-200 text-xs">
              <MensajeSinHorarios onClick={() => onOpenHorario(asignatura.id)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
