"use client";
import * as React from "react";

const pad = (n: number) => n.toString().padStart(2, "0");
const hhmmss = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function PqinaFlipClock({ className = "" }: { className?: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const tickRef = React.useRef<any>(null);
  const timerRef = React.useRef<{ stop?: () => void } | null>(null);

  React.useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        // carga solo en cliente
        const mod = await import("@pqina/flip");
        const Tick: any = (mod as any).default ?? (mod as any);

        const host = hostRef.current;
        if (!host || disposed) return;

        // Evita doble-montaje en modo estricto (dev)
        if (host.dataset.tickMounted === "1") return;
        host.dataset.tickMounted = "1";

        // Marcado mínimo que Flip/Tick espera
        host.innerHTML = `
          <div class="tick" aria-label="clock">
            <div data-repeat="true" aria-hidden="true">
              <span data-view="flip"></span>
            </div>
          </div>
        `;

        const el = host.querySelector(".tick") as HTMLElement;
        const tick = Tick.DOM.create(el);
        tick.value = "00:00:00";

        const update = () => { tick.value = hhmmss(); };
        update();
        const t = Tick.helper.interval(update, 1000);

        tickRef.current = tick;
        timerRef.current = t;
      } catch (e) {
        // si falla la carga, evita romper el layout
        console.error("Flip clock init failed:", e);
      }
    })();

    return () => {
      disposed = true;
      try { timerRef.current?.stop?.(); } catch {}
      try { tickRef.current?.destroy?.(); } catch {}
      const host = hostRef.current;
      if (host) {
        delete host.dataset.tickMounted;
        // opcional: limpia el HTML si quieres
        // host.innerHTML = "";
      }
    };
  }, []);

  return (
    <div ref={hostRef} className={className}>
      <style jsx>{`
       :global(.tick) { font-size: var(--tick-fs, .95rem); }
       :global(.tick .tick-flip) { border-radius: var(--tick-radius, .4rem); background: #303030; }
       :global(.tick .tick-flip-panel) { padding: var(--tick-pad-y, .08em) var(--tick-pad-x, .55ch); }
       :global(.tick-group) { margin-right: var(--tick-gap, .3rem); }
      `}</style>
    </div>
  );
}
