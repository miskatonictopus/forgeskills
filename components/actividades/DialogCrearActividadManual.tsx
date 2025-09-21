"use client";

import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // fechaInicial?: Date
};

export default function DialogCrearActividadManual({ open, onOpenChange }: Props) {
  const descId = React.useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={descId} className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Nueva actividad (manual)</DialogTitle>
          <DialogDescription id={descId}>
            Rellena los campos a mano. Después podrás editar y añadir CE.
          </DialogDescription>
        </DialogHeader>

        {/* TODO: aquí tu formulario real */}
        <div className="text-sm text-muted-foreground">
          (Formulario manual — pendiente de implementar)
        </div>
      </DialogContent>
    </Dialog>
  );
}
