"use client";

import * as React from "react";
import { PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type CE = { codigo: string; descripcion: string };
export type RA = { codigo: string; descripcion: string; CE: CE[] };
export type AsignaturaRA = { RA: RA[]; nombre?: string } | null | undefined;

export type ConfigActividadResult = {
  duracionMin: number;
  seleccion: Array<{
    raCodigo: string;
    raDescripcion: string;
    ceCodigo: string;
    ceDescripcion: string;
  }>;
  suggestedName: string;
};

type Props = {
  asignatura?: AsignaturaRA;
  raOptions?: RA[];
  disabled?: boolean;
  onApply: (r: ConfigActividadResult) => void;
  triggerClassName?: string;
  children?: React.ReactNode;
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

  // Lista base de RA
  const raList: RA[] = React.useMemo(
    () => (raOptions && raOptions.length ? raOptions : asignatura?.RA ?? []),
    [raOptions, asignatura]
  );

  // RA visible para navegar CE
  const [raVisibleCodigo, setRaVisibleCodigo] = React.useState<string | null>(null);
  const raVisible = React.useMemo(
    () => raList.find((r) => r.codigo === raVisibleCodigo) ?? null,
    [raList, raVisibleCodigo]
  );
  React.useEffect(() => {
    if (!raVisibleCodigo && raList.length) setRaVisibleCodigo(raList[0].codigo);
  }, [raList, raVisibleCodigo]);

  // Selección acumulada multi-RA/multi-CE
  const [seleccion, setSeleccion] = React.useState<
    Record<string, { raCodigo: string; raDescripcion: string; ceCodigo: string; ceDescripcion: string }>
  >({});

  const isChecked = (ra: RA, ce: CE) => !!seleccion[`${ra.codigo}.${ce.codigo}`];

  const toggleCE = (ra: RA, ce: CE, checked: boolean) => {
    const key = `${ra.codigo}.${ce.codigo}`;
    setSeleccion((prev) => {
      const next = { ...prev };
      if (checked) {
        next[key] = {
          raCodigo: ra.codigo,
          raDescripcion: ra.descripcion,
          ceCodigo: ce.codigo,
          ceDescripcion: ce.descripcion,
        };
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const clearAll = () => setSeleccion({});

  const canApply = !!duracionMin && Object.keys(seleccion).length > 0;

  const handleApply = () => {
    if (!canApply || !duracionMin) return;
    const items = Object.values(seleccion);

    let suggestedName = "";
    if (items.length === 1) {
      const it = items[0];
      suggestedName = `[${duracionMin === 30 ? "30m" : `${duracionMin / 60}h`}] ${it.raCodigo}.${it.ceCodigo} — ${shorten(
        it.ceDescripcion,
        64
      )}`;
    } else {
      const codes = items.slice(0, 3).map((i) => `${i.raCodigo}.${i.ceCodigo}`).join(", ");
      const extra = items.length > 3 ? ` +${items.length - 3}` : "";
      suggestedName = `[${duracionMin === 30 ? "30m" : `${duracionMin / 60}h`}] ${items.length} CE (${codes}${extra})`;
    }

    onApply({ duracionMin, seleccion: items, suggestedName });
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

      {/* Popover portaleado con z-index ALTO para quedar por encima del diálogo y su blur */}
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        forceMount
        className="
          z-[240] w-[720px] p-4 bg-zinc-800
          data-[state=open]:animate-in data-[state=closed]:animate-out
          data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
          data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
        "
        onOpenAutoFocus={(e) => e.preventDefault()} // evita saltos de foco dentro del Dialog
      >
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

          {/* RA para navegar */}
          <div>
            <p className="text-sm font-medium mb-2">Explorar RA</p>
            <Select
              value={raVisibleCodigo ?? undefined}
              onValueChange={setRaVisibleCodigo}
              disabled={disabled || raList.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona RA para ver sus CE" />
              </SelectTrigger>
              {/* menú del select aún más arriba */}
              <SelectContent className="z-[260] max-h-72">
                {raList.map((ra) => (
                  <SelectItem key={ra.codigo} value={ra.codigo}>
                    {ra.codigo} — {shorten(ra.descripcion, 64)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CE en tabla con checkboxes (multi-RA/multi-CE) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                Criterios de evaluación {raVisible ? `de ${raVisible.codigo}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{Object.keys(seleccion).length} seleccionados</Badge>
                {Object.keys(seleccion).length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearAll}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-md border">
              <div
                className="max-h-56 overflow-y-auto overscroll-contain pr-2"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="border-b">
                      <th className="w-10 p-2"></th>
                      <th className="w-28 p-2 text-left">Código</th>
                      <th className="p-2 text-left">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raVisible?.CE?.map((ce) => {
                      const checked = isChecked(raVisible, ce);
                      return (
                        <tr
                          key={ce.codigo}
                          className={`cursor-pointer border-b hover:bg-muted/50 ${checked ? "bg-muted" : ""}`}
                          onClick={() => toggleCE(raVisible, ce, !checked)}
                        >
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleCE(raVisible, ce, Boolean(v))}
                            />
                          </td>
                          <td className="p-2 font-medium">
                            {raVisible.codigo}.{ce.codigo}
                          </td>
                          <td className="p-2">{shorten(ce.descripcion, 160)}</td>
                        </tr>
                      );
                    })}
                    {(!raVisible || (raVisible?.CE?.length ?? 0) === 0) && (
                      <tr>
                        <td colSpan={3} className="p-3 text-muted-foreground text-sm">
                          {raVisible ? "Este RA no tiene CE asociados." : "Elige un RA para ver sus CE."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Chips de lo seleccionado */}
          {Object.keys(seleccion).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.values(seleccion).map((s) => {
                const key = `${s.raCodigo}.${s.ceCodigo}`;
                return (
                  <Badge key={key} variant="outline" className="gap-1">
                    {s.raCodigo}.{s.ceCodigo}
                    <button
                      type="button"
                      className="ml-1 opacity-70 hover:opacity-100"
                      onClick={() =>
                        setSeleccion((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        })
                      }
                      aria-label={`Quitar ${key}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDuracionMin(null);
                setRaVisibleCodigo(raList[0]?.codigo ?? null);
                setSeleccion({});
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
