// components/TimerFullscreen.tsx
"use client";

import * as React from "react";
import { useSnapshot } from "valtio";
import { timerStore, timerActions, formatHMS } from "@/store/timerStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import FlipDigits from "@/components/FlipDigits";

/** =========================
 *  Configura tus sonidos aquí
 *  ========================= */
const SOUND_CUES: Array<{ t: number; src: string }> = [
  { t: 900, src: "/sounds/alarma-15-10-5.mp3" }, // 15 min
  { t: 600, src: "/sounds/alarma-15-10-5.mp3" }, // 10 min
  { t: 300, src: "/sounds/alarma-15-10-5.mp3" },  // 5 min
  { t: 60,  src: "/sounds/alarma-15-10-5.mp3" },  // 1 min
  { t: 22,  src: "/sounds/alarma-22-segundos" }, // 22 s
];

// Si solo tienes 3 archivos, puedes reutilizarlos, por ejemplo:
// const SOUND_CUES = [
//   { t: 900, src: "/sounds/bell.mp3" },
//   { t: 600, src: "/sounds/bell.mp3" },
//   { t: 300, src: "/sounds/horn.mp3" },
//   { t: 60,  src: "/sounds/horn.mp3" },
//   { t: 22,  src: "/sounds/alarm.mp3" },
// ];

export default function TimerFullscreen() {
  const s = useSnapshot(timerStore);
  const [customMin, setCustomMin] = React.useState<number>(
    Math.round(s.totalSeconds / 60)
  );

  // --- Sincroniza el input si cambia el total
  React.useEffect(() => {
    setCustomMin(Math.max(0, Math.round(s.totalSeconds / 60)));
  }, [s.totalSeconds]);

  // --- Overlay dentro de ventana (sin Fullscreen API) + ESC cierra + bloquear scroll
  React.useEffect(() => {
    if (!s.open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") timerActions.setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [s.open]);

  // ==============
  // SONIDOS (cues)
  // ==============
  // Pre-carga de audios
  const audioMapRef = React.useRef<Map<number, HTMLAudioElement>>(new Map());
  const playedRef = React.useRef<Set<number>>(new Set());
  const prevRemainingRef = React.useRef<number>(s.remaining);

  React.useEffect(() => {
    // Preload (una sola vez)
    if (audioMapRef.current.size === 0) {
      const m = new Map<number, HTMLAudioElement>();
      for (const { t, src } of SOUND_CUES) {
        const a = new Audio(src);
        a.preload = "auto";
        // a.volume = 1; // ajusta si quieres
        m.set(t, a);
      }
      audioMapRef.current = m;
    }
  }, []);

  React.useEffect(() => {
    // Reset de “cues reproducidos” si el tiempo sube (reset o cambio de preset)
    if (s.remaining > prevRemainingRef.current) {
      playedRef.current.clear();
    }

    // Solo analizamos cuando está abierto
    if (!s.open) {
      prevRemainingRef.current = s.remaining;
      return;
    }

    const prev = prevRemainingRef.current;
    const now = s.remaining;

    // Detecta cruces de umbral: de >t a <=t
    for (const { t } of SOUND_CUES) {
      if (!playedRef.current.has(t) && prev > t && now <= t) {
        const audio = audioMapRef.current.get(t);
        if (audio) {
          // Reproducir con catch para evitar error si el navegador bloquea
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
        playedRef.current.add(t);
      }
    }

    prevRemainingRef.current = now;
  }, [s.remaining, s.open]);

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

  // Colores/animaciones
  const isWarning  = s.remaining <= 900; // 15 min → naranja
  const isCritical = s.remaining <= 300; // 5  min → rojo + pulse en dígitos

  return (
    <div
      aria-label="Temporizador a pantalla completa"
      role="dialog"
      aria-modal="true"
      className={`
        fixed inset-0 z-[9999]
        grid place-items-center timer-fs
        backdrop-blur-xl backdrop-brightness-75
        transition-colors duration-1000
        ${
          isCritical
            ? "bg-red-600/60"
            : isWarning
            ? "bg-orange-500/60"
            : "bg-black/60"
        }
      `}
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
        {/* Dígitos Flip (pulse solo en crítico) */}
        <div
          className={`
            [--tick-fs:clamp(3rem,8vw,10rem)]
            [--tick-radius:0.75rem]
            [--tick-bg:rgb(20,20,20)]
            [--tick-pad-x:0.3ch]
            [--tick-gap:0.35rem]
            text-white overflow-hidden font-bold
            ${isCritical ? "animate-pulse" : ""}
          `}
        >
          <FlipDigits value={formatHMS(s.remaining)} ariaLabel="Cuenta atrás" />
        </div>

        {/* Presets + input manual */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-white">
          <Button variant="secondary" onClick={() => applyPreset(2 * 3600)}>2 h</Button>
          <Button variant="secondary" onClick={() => applyPreset(1 * 3600)}>1 h</Button>
          <Button variant="secondary" onClick={() => applyPreset(30 * 60)}>30 min</Button>

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
          <Button variant="secondary" size="lg" onClick={timerActions.reset} aria-label="Reiniciar">
            <RotateCcw className="mr-2 h-5 w-5" /> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
