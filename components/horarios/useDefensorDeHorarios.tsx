"use client";

import { useRef, useState, useCallback } from "react";
import {
  DefensorDeHorariosDialog,
  type DefensorParams,
  type SlotSeleccionado,
} from "./DefensorDeHorariosDialog";

export function useDefensorDeHorarios() {
  const resolverRef = useRef<((v: SlotSeleccionado | null) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<DefensorParams | null>(null);

  const openDefensorDeHorarios = useCallback((p: DefensorParams) => {
    setParams(p);
    setOpen(true);
    return new Promise<SlotSeleccionado | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }, []);

  const handleSelect = useCallback((slot: SlotSeleccionado) => {
    setOpen(false);
    resolverRef.current?.(slot);
    resolverRef.current = null;
  }, []);

  const dialog = params ? (
    <DefensorDeHorariosDialog
      open={open}
      onOpenChange={(o: boolean) => (o ? setOpen(true) : handleCancel())}
      params={params}
      onSelect={handleSelect}
      onCancel={handleCancel}
    />
  ) : null;

  return { openDefensorDeHorarios, dialog };
}
