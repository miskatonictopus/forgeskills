// /store/timerStore.ts
import { proxy } from "valtio";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export const timerStore = proxy({
  hours: 0,
  minutes: 30,
  get totalSeconds() {
    return this.hours * 3600 + this.minutes * 60;
  },

  remaining: 30 * 60,
  running: false,
  hiddenUI: false,
  fullscreen: false,
  soundOn: true,
  open: false, // controla el Dialog

  // helpers
  formatHMS(): string {
    const s = Math.max(0, Math.floor(this.remaining));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  },
});

export const timerActions = {
  setDuration(h: number, m: number) {
    timerStore.hours = clamp(h, 0, 12);
    timerStore.minutes = clamp(m, 0, 59);
    if (!timerStore.running) timerStore.remaining = timerStore.totalSeconds;
  },
  start() {
    if (timerStore.remaining <= 0) timerStore.remaining = timerStore.totalSeconds;
    timerStore.running = true;
  },
  pause() {
    timerStore.running = false;
  },
  reset() {
    timerStore.running = false;
    timerStore.remaining = timerStore.totalSeconds;
  },
  tick(beep?: () => void) {
    if (!timerStore.running) return;
    const next = timerStore.remaining - 1;
    if (next <= 0) {
      timerStore.remaining = 0;
      timerStore.running = false;
      if (timerStore.soundOn && beep) beep();
    } else {
      timerStore.remaining = next;
    }
  },
  setOpen(v: boolean) {
    timerStore.open = v;
  },
  setHidden(v: boolean) {
    timerStore.hiddenUI = v;
  },
  toggleSound() {
    timerStore.soundOn = !timerStore.soundOn;
  },
};
