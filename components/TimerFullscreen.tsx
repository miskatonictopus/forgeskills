"use client";

import * as React from "react";
import { useSnapshot } from "valtio";
import { timerStore, timerActions, formatHMS } from "@/store/timerStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause, Play, RotateCcw, X } from "lucide-react";

export default function TimerFullscreen() {
  const s = useSnapshot(timerStore);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [customMin, setCustomMin] = React.useState<number>(Math.round(s.totalSeconds / 60));

  // Mantener el input sincronizado si cambia el total desde fuera
  React.useEffect(() => {
    setCustomMin(Math.max(0, Math.round(s.totalSeconds / 60)));
  }, [s.totalSeconds]);

  // Fullscreen API + ESC para salir
  React.useEffect(() => {
    if (!s.open) return;

    const node = containerRef.current ?? document.documentElement;

    type FullscreenTarget = Element & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    type FullscreenDoc = Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    (async () => {
      try {
        const target = node as FullscreenTarget;
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          target.webkitRequestFullscreen?.();
        }
      } catch {}
    })();

    const onFsChange = () => {
      if (!document.fullscreenElement) timerActions.setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") timerActions.setOpen(false);
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [s.open]);

  if (!s.open) return null;

  function applyPreset(seconds: number) {
    timerActions.pause();
    timerActions.setTotal(seconds);
    timerActions.reset();
  }

  function applyCustom() {
    const mins = Number.isFinite(customMin) ? Math.max(0, Math.round(customMin)) : 0;
    applyPreset(mins * 60);
  }

  return (
    <div
      ref={containerRef}
      aria-label="Temporizador a pantalla completa"
      role="dialog"
      aria-modal="true"
      className="
        fixed inset-0 z-[9999]
        bg-black/70 backdrop-blur-lg
        grid place-items-center
      "
    >
      {/* Cerrar (X) arriba derecha */}
      <button
        onClick={() => timerActions.setOpen(false)}
        aria-label="Cerrar temporizador"
        className="
          absolute top-5 right-6
          inline-flex h-10 w-10 items-center justify-center
          rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25
          text-white transition
        "
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-10 px-6">
        {/* Tiempo grande */}
        <div className="font-mono tabular-nums text-white text-7xl sm:text-8xl md:text-9xl">
          {formatHMS(s.remaining)}
        </div>

        {/* Presets + input manual */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-white">
          <Button variant="secondary" onClick={() => applyPreset(2 * 3600)}>
            2 h
          </Button>
          <Button variant="secondary" onClick={() => applyPreset(1 * 3600)}>
            1 h
          </Button>
          <Button variant="secondary" onClick={() => applyPreset(30 * 60)}>
            30 min
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={String(customMin)}
              onChange={(e) => setCustomMin(Number(e.target.value))}
              className="w-28 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              placeholder="min"
              aria-label="Minutos personalizados"
            />
            <Button onClick={applyCustom}>Aplicar</Button>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-4">
          {s.running ? (
            <Button size="lg" onClick={timerActions.pause} aria-label="Pausar">
              <Pause className="mr-2 h-5 w-5" /> Pausar
            </Button>
          ) : (
            <Button size="lg" onClick={timerActions.start} aria-label="Reanudar">
              <Play className="mr-2 h-5 w-5" /> Reanudar
            </Button>
          )}

          <Button
            variant="secondary"
            size="lg"
            onClick={timerActions.reset}
            aria-label="Reiniciar"
          >
            <RotateCcw className="mr-2 h-5 w-5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
