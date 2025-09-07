"use client";

import { proxy, subscribe } from "valtio";

type TimerState = {
  totalSeconds: number;   // duración configurada
  remaining: number;      // segundos que quedan
  running: boolean;       // si está en marcha
  open: boolean;          // modal/ pantalla completa abierta
  _intervalId: number | null; // interno para el tick
  _lastTs: number | null;     // timestamp del último tick
};

// ---- Utilidad pura para formatear (HH:MM:SS) ----
export function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const sss = ss.toString().padStart(2, "0");
  return h > 0 ? `${hh}:${mm}:${sss}` : `${mm}:${sss}`;
}

export const timerStore = proxy<TimerState>({
  totalSeconds: 25 * 60, // 25 min por defecto (ajústalo a lo que uses)
  remaining: 25 * 60,
  running: false,
  open: false,
  _intervalId: null,
  _lastTs: null,
});

// ---- Acciones seguras ----
function clearTick() {
  if (timerStore._intervalId != null) {
    clearInterval(timerStore._intervalId);
    timerStore._intervalId = null;
  }
  timerStore._lastTs = null;
}

function tick() {
  const now = Date.now();
  if (timerStore._lastTs == null) {
    timerStore._lastTs = now;
    return;
  }
  const deltaSec = (now - timerStore._lastTs) / 1000;
  timerStore._lastTs = now;

  if (!timerStore.running) return;

  const next = timerStore.remaining - deltaSec;
  if (next <= 0) {
    timerStore.remaining = 0;
    timerStore.running = false;
    clearTick();
  } else {
    timerStore.remaining = next;
  }
}

export const timerActions = {
  start() {
    if (timerStore.running) return;
    if (timerStore.remaining <= 0) {
      // si está a cero, rearmar al total antes de arrancar
      timerStore.remaining = timerStore.totalSeconds;
    }
    timerStore.running = true;
    timerStore._lastTs = null;
    clearTick();
    timerStore._intervalId = setInterval(tick, 250) as unknown as number;
  },

  pause() {
    timerStore.running = false;
    clearTick();
  },

  reset() {
    timerStore.running = false;
    timerStore.remaining = timerStore.totalSeconds;
    clearTick();
  },

  setTotal(seconds: number) {
    // si no está corriendo, también actualizamos remaining
    timerStore.totalSeconds = Math.max(0, Math.floor(seconds));
    if (!timerStore.running) {
      timerStore.remaining = timerStore.totalSeconds;
    }
  },

  setOpen(v: boolean) {
    timerStore.open = v;
  },
};

// Limpieza defensiva si alguien hace hot-reload
subscribe(timerStore, () => {
  if (!timerStore.running && timerStore._intervalId != null) {
    clearTick();
  }
});
