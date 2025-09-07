"use client";

import { useSnapshot } from "valtio";
import { timerStore, timerActions, formatHMS } from "@/store/timerStore";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function TimerTray() {
  const s = useSnapshot(timerStore);

  // Si quieres ocultarlo cuando está parado y en “inicio”
  // if (!s.running && Math.floor(s.remaining) === s.totalSeconds) return null;

  return (
    <div
      className={cn(
        "ml-3 flex items-center gap-2 rounded-full border px-2 py-1",
        "bg-background/70 backdrop-blur text-sm"
      )}
    >
      <span className="font-mono tabular-nums">{formatHMS(s.remaining)}</span>

      {s.running ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={timerActions.pause}
          title="Pausar"
          aria-label="Pausar temporizador"
        >
          <Pause className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          onClick={timerActions.start}
          title="Reanudar"
          aria-label="Reanudar temporizador"
        >
          <Play className="h-4 w-4" />
        </Button>
      )}

      <Button
        size="icon"
        variant="ghost"
        onClick={timerActions.reset}
        title="Reset"
        aria-label="Reiniciar temporizador"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        onClick={() => timerActions.setOpen(true)}
        title="Abrir a pantalla completa"
        aria-label="Abrir a pantalla completa"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
