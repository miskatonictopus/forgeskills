"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WandSparkles, ClipboardPen, Wifi } from "lucide-react";

type SelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: "manual" | "llm") => void;
  closeOnSelect?: boolean;
  disableLLM?: boolean;
  className?: string;
};

export default function DialogSelectorActividad({
  open,
  onOpenChange,
  onSelect,
  closeOnSelect = true,
  disableLLM = false,
  className,
}: SelectorProps) {
  const descId = React.useId();

  function handleSelect(mode: "manual" | "llm") {
    if (closeOnSelect) onOpenChange(false);
    onSelect(mode);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Overlay por debajo del content, pero por encima de todo lo demás */}
        <DialogOverlay
          className={cn(
            "fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          )}
        />
        <DialogContent
          aria-describedby={descId}
          className={cn(
            "z-[90] sm:max-w-[640px] p-0 overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
            "duration-200",
            className
          )}
        >
          <div className="p-6">
            <DialogHeader className="text-left">
              <DialogTitle>Crear actividad</DialogTitle>
              <DialogDescription id={descId}>
                Elige cómo quieres crear tu actividad. Introduce tu actividad
                manualmente o crea una actividad mediante LLM + Heuristic
                Method.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card
                tabIndex={0}
                role="button"
                onClick={() => handleSelect("manual")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleSelect("manual");
                }}
                className="
    group cursor-pointer rounded-2xl border bg-card/60
    transition-colors duration-200
    hover:bg-zinc-900 hover:border-primary/30
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
    active:scale-[.99]
  "
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ClipboardPen className="h-5 w-5" aria-hidden />
                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                      Crear manualmente
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="text-xs text-muted-foreground group-hover:text-foreground/90 transition-colors">
                  Si ya tienes tu actividad en mente, tan sólo escríbela o sube
                  tu archivo, el sistema te detectará los CE automáticamente o
                  podrás seleccionarlos manualmente
                </CardContent>
              </Card>

              <Card
                tabIndex={disableLLM ? -1 : 0}
                aria-disabled={disableLLM}
                role="button"
                onClick={() => !disableLLM && handleSelect("llm")}
                onKeyDown={(e) => {
                  if (disableLLM) return;
                  if (e.key === "Enter" || e.key === " ") handleSelect("llm");
                }}
                className="
    group cursor-pointer rounded-2xl border bg-card/60
    transition-colors duration-200
    hover:bg-zinc-900 hover:border-primary/30
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
    active:scale-[.99]
  "
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <WandSparkles className="h-5 w-5" aria-hidden />
                    <CardTitle className="text-base">
                      Crear mediante LLM + H
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Selecciona los CE para los que quieres crear la actividad, el
                  tiempo de actividad y tu metología preferida y nuestro sistema
                  creará una actividad a medida{" "}
                  <span className="inline-flex items-center gap-1 mt-2 text-white">
                    <Wifi className="h-4 w-4" /> Requiere conexión online
                  </span>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-6" />

            <div className="flex items-center justify-end gap-2">
              <Button variant="default" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
