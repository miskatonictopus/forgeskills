// FullscreenTimer.tsx
"use client";

import * as React from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Pause, Play, RotateCcw, Maximize2, Minimize2, Eye, EyeOff, Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { timerStore, timerActions } from "@/store/timerStore";

function useInterval(callback: () => void, delay: number | null) {
  const savedRef = React.useRef(callback);
  React.useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  React.useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {}
}

const presets = [
  { label: "5m", h: 0, m: 5 },
  { label: "10m", h: 0, m: 10 },
  { label: "15m", h: 0, m: 15 },
  { label: "30m", h: 0, m: 30 },
  { label: "45m", h: 0, m: 45 },
  { label: "1h", h: 1, m: 0 },
  { label: "2h", h: 2, m: 0 },
];

export function FullscreenTimer() {
  const s = useSnapshot(timerStore);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // sincroniza remaining si cambia la duración y NO está corriendo
  React.useEffect(() => {
    if (!s.running) timerStore.remaining = timerStore.totalSeconds;
  }, [s.totalSeconds, s.running]);

  // tick
  useInterval(() => timerActions.tick(beep), s.running ? 1000 : null);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await (wrapRef.current ?? document.documentElement).requestFullscreen();
        timerStore.fullscreen = true;
      } else {
        await document.exitFullscreen();
        timerStore.fullscreen = false;
      }
    } catch {
      timerStore.fullscreen = !s.fullscreen;
    }
  }

  const progress = s.totalSeconds > 0 ? (1 - s.remaining / s.totalSeconds) * 100 : 0;
  const isFinished = s.remaining <= 0 && s.totalSeconds > 0;

  return (
    <Dialog
      open={s.open}
      onOpenChange={async (v) => {
        // NO paramos el timer al cerrar
        if (!v && document.fullscreenElement) await document.exitFullscreen();
        timerActions.setOpen(v);
      }}
    >
      <DialogContent
        className={cn(
          "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0",
          "!z-50 !w-screen !h-screen !max-w-none !p-0 !rounded-none !border-0",
          "!bg-background !text-foreground",
          "flex flex-col"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Temporizador de clase</DialogTitle>
          <DialogDescription>Cuenta atrás a pantalla completa con controles.</DialogDescription>
        </DialogHeader>

        <div className="h-1 w-full bg-muted/40 shrink-0">
          <div className="h-1 bg-primary transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>

        {!s.hiddenUI && (
          <div className="flex items-center justify-between px-6 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => timerActions.setDuration(p.h, p.m)}
                  disabled={s.running}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Horas</label>
                <input
                  type="number"
                  className="w-16 rounded-md border bg-background px-2 py-1"
                  min={0}
                  max={12}
                  value={s.hours}
                  onChange={(e) => timerActions.setDuration(Number(e.target.value || 0), s.minutes)}
                  disabled={s.running}
                />
                <label className="text-sm text-muted-foreground">Min</label>
                <input
                  type="number"
                  className="w-16 rounded-md border bg-background px-2 py-1"
                  min={0}
                  max={59}
                  value={s.minutes}
                  onChange={(e) => timerActions.setDuration(s.hours, Number(e.target.value || 0))}
                  disabled={s.running}
                />
              </div>

              <Button variant={s.soundOn ? "default" : "outline"} size="icon" onClick={() => timerActions.toggleSound()} title={s.soundOn ? "Sonido activado" : "Sonido desactivado"}>
                <Volume2 className="h-4 w-4" />
              </Button>

              <Button variant="outline" size="icon" onClick={() => timerActions.setHidden(!s.hiddenUI)} title={s.hiddenUI ? "Mostrar controles (H)" : "Ocultar controles (H)"}>
                {s.hiddenUI ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              <Button variant="outline" size="icon" onClick={toggleFullscreen} title={s.fullscreen ? "Salir pantalla completa (F)" : "Pantalla completa (F)"}>
                {s.fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div ref={wrapRef} className={cn("relative flex-1 flex flex-col items-center justify-center px-6", isFinished ? "bg-destructive/5" : "bg-transparent")}>
          <div className="font-semibold select-none text-center text-6xl sm:text-7xl md:text-8xl lg:text-9xl">
            {s.formatHMS()}
          </div>

          {!s.hiddenUI && !s.running && s.totalSeconds > 0 && (
            <div className="mt-8 w-full max-w-2xl px-4">
              <Slider value={[s.remaining]} min={0} max={s.totalSeconds} step={60} onValueChange={([v]) => (timerStore.remaining = v)} />
            </div>
          )}

          {!s.hiddenUI && (
            <div className="mt-10 flex items-center gap-3">
              {!s.running ? (
                <Button size="lg" onClick={() => timerActions.start()}>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar (ESPACIO)
                </Button>
              ) : (
                <Button size="lg" variant="secondary" onClick={() => timerActions.pause()}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausa (ESPACIO)
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => timerActions.reset()}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset (R)
              </Button>
            </div>
          )}

          {isFinished && !s.hiddenUI && <p className="mt-6 text-lg text-destructive font-medium">¡Tiempo!</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
