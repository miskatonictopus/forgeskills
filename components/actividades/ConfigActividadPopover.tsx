"use client";

import * as React from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export type CE = { codigo: string; descripcion: string };
export type RA = { codigo: string; descripcion: string; CE: CE[] };
export type AsignaturaRA = { RA: RA[]; nombre?: string } | null | undefined;

export type ConfigActividadResult = {
  duracionMin: number;
  raCodigo: string;
  ceCodigo: string;
  raDescripcion: string;
  ceDescripcion: string;
  suggestedName: string;
};

type Props = {
  /** Si tienes el objeto asignatura con RA[] */
  asignatura?: AsignaturaRA;
  /** O pásame directamente la lista de RA/CE */
  raOptions?: RA[];
  disabled?: boolean;
  onApply: (r: ConfigActividadResult) => void;
  triggerClassName?: string;
  children?: React.ReactNode; // trigger personalizado
};

function shorten(text: string, max = 60) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export default function ConfigActividadPopover({
  asignatura,
  raOptions,
  disabled,
  onApply,
  triggerClassName,
  children,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [duracionMin, setDuracionMin] = React.useState<number | null>(null);
  const [raSel, setRaSel] = React.useState<RA | null>(null);
  const [ceSel, setCeSel] = React.useState<CE | null>(null);

  // Fuente única de RA: prioridad a raOptions; si no, usa asignatura?.RA
  const raList: RA[] = React.useMemo(
    () => (raOptions && raOptions.length ? raOptions : asignatura?.RA ?? []),
    [raOptions, asignatura]
  );

  const canApply = !!duracionMin && !!raSel && !!ceSel;

  const handleApply = () => {
    if (!canApply || !raSel || !ceSel || !duracionMin) return;

    const raDotCeCode = `${raSel.codigo}.${ceSel.codigo}`;
    const suggestedName = `[${duracionMin === 30 ? "30m" : `${duracionMin / 60}h`}] ${raDotCeCode} — ${shorten(
      ceSel.descripcion,
      64
    )}`;

    onApply({
      duracionMin,
      raCodigo: raSel.codigo,
      ceCodigo: ceSel.codigo,
      raDescripcion: raSel.descripcion,
      ceDescripcion: ceSel.descripcion,
      suggestedName,
    });

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            type="button"
            variant="outline"
            aria-label="Configurar actividad"
            className={triggerClassName}
            disabled={disabled}
          >
            <PlusCircle className="w-4 h-4" />
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent side="right" align="start" className="w-80 p-4">
        <div className="space-y-4">
          {/* Duración */}
          <div>
            <p className="text-sm font-medium mb-2">Duración de la actividad</p>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 120, 180].map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={duracionMin === m ? "default" : "outline"}
                  onClick={() => setDuracionMin(m)}
                >
                  {m === 30 ? "30 min" : `${m / 60} h`}
                </Button>
              ))}
            </div>
          </div>

          {/* RA */}
          <div>
            <p className="text-sm font-medium mb-2">Resultado de aprendizaje</p>
            <Select
              value={raSel?.codigo}
              onValueChange={(v) => {
                const found = raList.find((r) => r.codigo === v) || null;
                setRaSel(found);
                setCeSel(null);
              }}
              disabled={disabled || raList.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona RA" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {raList.map((ra) => (
                  <SelectItem key={ra.codigo} value={ra.codigo}>
                    {ra.codigo} — {shorten(ra.descripcion, 64)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CE */}
          <div>
            <p className="text-sm font-medium mb-2">Criterio de evaluación</p>
            <Select
              value={ceSel?.codigo}
              onValueChange={(v) => {
                const found = raSel?.CE.find((c) => c.codigo === v) || null;
                setCeSel(found);
              }}
              disabled={!raSel || (raSel?.CE?.length ?? 0) === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={raSel ? "Selecciona CE" : "Elige antes un RA"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {raSel?.CE?.map((ce) => (
                  <SelectItem key={ce.codigo} value={ce.codigo}>
                    {raSel.codigo}.{ce.codigo} — {shorten(ce.descripcion, 64)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDuracionMin(null);
                setRaSel(null);
                setCeSel(null);
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleApply} disabled={!canApply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
