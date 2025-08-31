// /store/timerStore.ts
import { proxy } from "valtio";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Milestones en segundos
type MilestoneKey = 600 | 300 | 60 | 30 | 0;
// Claves de audio (según tus ficheros)
type AudioKey = "10" | "5" | "1" | "30s" | "bye";

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
  open: false,

  milestones: {
    600: false,
    300: false,
    60:  false,
    30:  false,
    0:   false,
  } as Record<MilestoneKey, boolean>,

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

function resetMilestones() {
  (Object.keys(timerStore.milestones) as unknown as MilestoneKey[]).forEach(
    (k) => (timerStore.milestones[k] = false)
  );
}

export const timerActions = {
  setDuration(h: number, m: number) {
    timerStore.hours = clamp(h, 0, 12);
    timerStore.minutes = clamp(m, 0, 59);
    if (!timerStore.running) timerStore.remaining = timerStore.totalSeconds;
    resetMilestones();
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
    resetMilestones();
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

  // Tick con audios MP3
  tick(opts?: {
    play?: (which: AudioKey) => void; // "10" | "5" | "1" | "30s" | "bye"
    beep?: () => void;
  }) {
    if (!timerStore.running) return;

    const prev = timerStore.remaining;
    const next = prev - 1;

    const crossed = (t: MilestoneKey) =>
      prev > t && next <= t && !timerStore.milestones[t];

    if (crossed(600)) {
      timerStore.milestones[600] = true;
      if (timerStore.soundOn) opts?.play?.("10");
    }
    if (crossed(300)) {
      timerStore.milestones[300] = true;
      if (timerStore.soundOn) opts?.play?.("5");
    }
    if (crossed(60)) {
      timerStore.milestones[60] = true;
      if (timerStore.soundOn) opts?.play?.("1");
    }
    if (crossed(30)) {
      timerStore.milestones[30] = true;
      if (timerStore.soundOn) opts?.play?.("30s");
    }

    if (next <= 0) {
      timerStore.remaining = 0;
      timerStore.running = false;
      if (!timerStore.milestones[0]) {
        timerStore.milestones[0] = true;
        if (timerStore.soundOn) opts?.play?.("bye");
      }
      if (timerStore.soundOn) opts?.beep?.(); // opcional
      return;
    }

    timerStore.remaining = next;
  },
};
