"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Pause,
  Play,
  RotateCcw,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Volume2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type FullscreenTimerProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

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

export function FullscreenTimer({ open, onOpenChange }: FullscreenTimerProps) {
  // Duración
  const [hours, setHours] = React.useState(0);
  const [minutes, setMinutes] = React.useState(30);
  const totalSeconds = React.useMemo(
    () => hours * 3600 + minutes * 60,
    [hours, minutes]
  );

  // Estado
  const [remaining, setRemaining] = React.useState(totalSeconds);
  const [running, setRunning] = React.useState(false);
  const [hiddenUI, setHiddenUI] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(true);

  // Ajuste cuando cambia duración
  React.useEffect(() => {
    if (!running) setRemaining(totalSeconds);
  }, [totalSeconds, running]);

  // Tick
  useInterval(
    () => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          if (soundOn) beep();
          setRunning(false);
          return 0;
        }
        return next;
      });
    },
    running ? 1000 : null
  );

  // Atajos
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        setRunning((v) => !v);
      } else if (e.key.toLowerCase() === "r") {
        reset();
      } else if (e.key.toLowerCase() === "h") {
        setHiddenUI((v) => !v);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  function start() {
    if (remaining <= 0) setRemaining(totalSeconds);
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setRemaining(totalSeconds);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await (wrapRef.current ?? document.documentElement).requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((v) => !v);
    }
  }

  function beep() {
    try {
      const ctx =
        new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(
        0.3,
        ctx.currentTime + 0.02
      );
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.4
      );
      o.start();
      o.stop(ctx.currentTime + 0.42);
    } catch {}
  }

  const progress =
    totalSeconds > 0 ? (1 - remaining / totalSeconds) * 100 : 0;
  const isFinished = remaining <= 0 && totalSeconds > 0;

  const presets = [
    { label: "5m", h: 0, m: 5 },
    { label: "10m", h: 0, m: 10 },
    { label: "15m", h: 0, m: 15 },
    { label: "30m", h: 0, m: 30 },
    { label: "45m", h: 0, m: 45 },
    { label: "1h", h: 1, m: 0 },
    { label: "2h", h: 2, m: 0 },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setRunning(false);
        if (!v && document.fullscreenElement) document.exitFullscreen();
        onOpenChange(v);
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
        {/* A11y oculto */}
        <DialogHeader className="sr-only">
          <DialogTitle>Temporizador de clase</DialogTitle>
          <DialogDescription>
            Cuenta atrás a pantalla completa con controles.
          </DialogDescription>
        </DialogHeader>

        {/* Barra superior de progreso */}
        <div className="h-1 w-full bg-muted/40 shrink-0">
          <div
            className="h-1 bg-primary transition-[width] duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
          />
        </div>

        {/* Controles superiores */}
        {!hiddenUI && (
          <div className="flex items-center justify-between px-6 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHours(p.h);
                    setMinutes(p.m);
                    setRunning(false);
                    setRemaining(p.h * 3600 + p.m * 60);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">
                  Horas
                </label>
                <input
                  type="number"
                  className="w-16 rounded-md border bg-background px-2 py-1"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.max(0, Number(e.target.value || 0)))
                  }
                  disabled={running}
                />
                <label className="text-sm text-muted-foreground">
                  Min
                </label>
                <input
                  type="number"
                  className="w-16 rounded-md border bg-background px-2 py-1"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.min(59, Math.max(0, Number(e.target.value || 0)))
                    )
                  }
                  disabled={running}
                />
              </div>

              <Button
                variant={soundOn ? "default" : "outline"}
                size="icon"
                onClick={() => setSoundOn((v) => !v)}
                title={soundOn ? "Sonido activado" : "Sonido desactivado"}
              >
                <Volume2 className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setHiddenUI((v) => !v)}
                title={
                  hiddenUI ? "Mostrar controles (H)" : "Ocultar controles (H)"
                }
              >
                {hiddenUI ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={
                  fullscreen
                    ? "Salir pantalla completa (F)"
                    : "Pantalla completa (F)"
                }
              >
                {fullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Zona principal centrada */}
        <div
          ref={wrapRef}
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center px-6",
            isFinished ? "bg-destructive/5" : "bg-transparent"
          )}
        >
          <div className="font-semibold select-none text-center text-6xl sm:text-7xl md:text-8xl lg:text-9xl">
            {formatHMS(remaining)}
          </div>

          {!hiddenUI && !running && totalSeconds > 0 && (
            <div className="mt-8 w-full max-w-2xl px-4">
              <Slider
                value={[remaining]}
                min={0}
                max={totalSeconds}
                step={60}
                onValueChange={([v]) => setRemaining(v)}
              />
            </div>
          )}

          {!hiddenUI && (
            <div className="mt-10 flex items-center gap-3">
              {!running ? (
                <Button size="lg" onClick={start}>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar (ESPACIO)
                </Button>
              ) : (
                <Button size="lg" variant="secondary" onClick={pause}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausa (ESPACIO)
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset (R)
              </Button>
            </div>
          )}

          {isFinished && !hiddenUI && (
            <p className="mt-6 text-lg text-destructive font-medium">
              ¡Tiempo!
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
