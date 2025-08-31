// FullscreenTimer.tsx
"use client";

import * as React from "react";
import { useSnapshot } from "valtio";
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

// --- Audio manager para los hitos (usa /public/sounds/*.mp3) ---
// --- Audio manager robusto para /public/sounds/*.mp3 ---
function useMilestoneAudio() {
  type Key = "10" | "5" | "1" | "30s" | "bye";
  const audiosRef = React.useRef<Record<Key, HTMLAudioElement> | null>(null);

  React.useEffect(() => {
    // Construye URLs absolutas (evita problemas de basePath o rutas relativas)
    const base = window.location.origin;
    const make = (path: string) => new URL(path, base).toString();

    const a10 = new Audio(make("/sounds/10.mp3"));
    const a5 = new Audio(make("/sounds/5.mp3"));
    const a1 = new Audio(make("/sounds/1.mp3"));
    const a30 = new Audio(make("/sounds/30s.mp3"));
    const aby = new Audio(make("/sounds/bye.mp3"));

    const all: [string, HTMLAudioElement][] = [
      ["10", a10],
      ["5", a5],
      ["1", a1],
      ["30s", a30],
      ["bye", aby],
    ];

    // preload + volumen + manejo de errores
    all.forEach(([name, el]) => {
      el.preload = "auto";
      el.crossOrigin = "anonymous"; // por si en producción hay CDN
      el.onerror = () => {
        console.error(`[TimerAudio] No se pudo cargar ${name}.mp3 (${el.src})`);
      };
      el.onstalled = () => {
        console.warn(`[TimerAudio] Recurso estancado ${name}.mp3`);
      };
      el.load();
    });

    // volúmenes (bye más alto)
    const normalVol = 0.9;
    a10.volume = normalVol;
    a5.volume = normalVol;
    a1.volume = normalVol;
    a30.volume = normalVol;
    aby.volume = 1.0;

    audiosRef.current = { "10": a10, "5": a5, "1": a1, "30s": a30, bye: aby };

    return () => {
      // Limpieza básica
      Object.values(audiosRef.current ?? {}).forEach((el) => {
        el.pause();
        // Opcional: liberar src
        // el.src = "";
      });
      audiosRef.current = null;
    };
  }, []);

  const play = React.useCallback((which: Key) => {
    const a = audiosRef.current?.[which];
    if (!a) return;

    try {
      a.currentTime = 0;
      // Si todavía no está listo, espera al primer canplay y luego reproduce
      if (a.readyState < 2) {
        const handler = () => {
          a.removeEventListener("canplaythrough", handler);
          void a.play().catch(() => {});
        };
        a.addEventListener("canplaythrough", handler, { once: true });
        a.load();
      } else {
        void a.play().catch(() => {});
      }
    } catch (err) {
      console.error(`[TimerAudio] Error al reproducir ${which}:`, err);
    }
  }, []);

  return { play };
}


export function FullscreenTimer() {
  const s = useSnapshot(timerStore);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const { play } = useMilestoneAudio();

  // Sincroniza remaining si cambia la duración REAL y NO está corriendo (evita reset al pausar)
  const prevTotalRef = React.useRef(s.totalSeconds);
  React.useEffect(() => {
    if (!s.running && s.totalSeconds !== prevTotalRef.current) {
      timerStore.remaining = timerStore.totalSeconds;
    }
    prevTotalRef.current = s.totalSeconds;
  }, [s.totalSeconds, s.running]); // mantener tamaño deps (HMR friendly)

  // Tick: ahora pasamos play para los hitos + beep opcional al final
  useInterval(
    () =>
      timerActions.tick({
        play, // "10" | "5" | "1" | "30s" | "bye"
        beep, // opcional: pitido corto al terminar
      }),
    s.running ? 1000 : null
  );

  // Atajos de teclado mientras el diálogo esté abierto
  React.useEffect(() => {
    if (!s.open) return;

    const onKey = async (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "h") {
        e.preventDefault();
        timerActions.setHidden(!timerStore.hiddenUI);
      } else if (k === " ") {
        e.preventDefault();
        s.running ? timerActions.pause() : timerActions.start();
      } else if (k === "r") {
        e.preventDefault();
        timerActions.reset();
      } else if (k === "f") {
        e.preventDefault();
        await toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open, s.running]);

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

  const progress =
    s.totalSeconds > 0 ? (1 - s.remaining / s.totalSeconds) * 100 : 0;
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
          <DialogDescription>
            Cuenta atrás a pantalla completa con controles.
          </DialogDescription>
        </DialogHeader>

        {/* Barra superior de progreso */}
        <div className="h-1 w-full bg-muted/40 shrink-0">
          <div
            className="h-1 bg-primary transition-[width] duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        {/* Controles superiores */}
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
                  onChange={(e) =>
                    timerActions.setDuration(Number(e.target.value || 0), s.minutes)
                  }
                  disabled={s.running}
                />
                <label className="text-sm text-muted-foreground">Min</label>
                <input
                  type="number"
                  className="w-16 rounded-md border bg-background px-2 py-1"
                  min={0}
                  max={59}
                  value={s.minutes}
                  onChange={(e) =>
                    timerActions.setDuration(s.hours, Number(e.target.value || 0))
                  }
                  disabled={s.running}
                />
              </div>

              <Button
                variant={s.soundOn ? "default" : "outline"}
                size="icon"
                onClick={() => timerActions.toggleSound()}
                title={s.soundOn ? "Sonido activado" : "Sonido desactivado"}
              >
                <Volume2 className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => timerActions.setHidden(!s.hiddenUI)}
                title={s.hiddenUI ? "Mostrar controles (H)" : "Ocultar controles (H)"}
              >
                {s.hiddenUI ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                title={s.fullscreen ? "Salir pantalla completa (F)" : "Pantalla completa (F)"}
              >
                {s.fullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Zona principal */}
        <div
          ref={wrapRef}
          onDoubleClick={() => timerActions.setHidden(!s.hiddenUI)} // opcional
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center px-6",
            isFinished ? "bg-destructive/5" : "bg-transparent"
          )}
        >
          {/* Handle visible cuando la UI está oculta */}
          {s.hiddenUI && (
            <button
              onClick={() => timerActions.setHidden(false)}
              title="Mostrar controles (H)"
              className="absolute top-3 right-3 z-50 rounded-full border bg-background/70 backdrop-blur px-2.5 py-2 shadow hover:bg-background"
            >
              <Eye className="h-5 w-5" />
            </button>
          )}

          <div className="font-semibold select-none text-center text-6xl sm:text-7xl md:text-8xl lg:text-9xl">
            {s.formatHMS()}
          </div>

          {!s.hiddenUI && !s.running && s.totalSeconds > 0 && (
            <div className="mt-8 w-full max-w-2xl px-4">
              <Slider
                value={[s.remaining]}
                min={0}
                max={s.totalSeconds}
                step={60}
                onValueChange={([v]) => (timerStore.remaining = v)}
              />
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

          {isFinished && !s.hiddenUI && (
            <p className="mt-6 text-lg text-destructive font-medium">¡Tiempo!</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
