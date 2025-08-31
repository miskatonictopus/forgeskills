// TimerTray.tsx
"use client";

import { useSnapshot } from "valtio";
import { timerStore, timerActions } from "@/store/timerStore";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function TimerTray() {
  const s = useSnapshot(timerStore);

  // si nunca se ha tocado, puedes ocultarlo retornando null
  // return null para ocultar cuando está "en cero" y parado:
  // if (!s.running && s.remaining === s.totalSeconds) return null;

  return (
    <div
      className={cn(
        "ml-3 flex items-center gap-2 rounded-full border px-2 py-1",
        "bg-background/70 backdrop-blur text-sm"
      )}
    >
      <span className="font-mono tabular-nums">{s.formatHMS()}</span>
      {s.running ? (
        <Button size="icon" variant="ghost" onClick={() => timerActions.pause()} title="Pausar">
          <Pause className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost" onClick={() => timerActions.start()} title="Reanudar">
          <Play className="h-4 w-4" />
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={() => timerActions.reset()} title="Reset">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={() => timerActions.setOpen(true)} title="Abrir a pantalla completa">
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
