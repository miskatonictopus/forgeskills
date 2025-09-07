"use client";
import * as React from "react";

/**
 * Componente genérico de dígitos flip.
 * - value: string a mostrar (ej: "01:23:45" ó "10:00")
 * - ariaLabel: accesibilidad (por defecto "countdown")
 * - className: para estilos externos
 *
 * Importante: Asegúrate de tener el CSS de @pqina/flip cargado a nivel global.
 */
export default function FlipDigits({
  value,
  ariaLabel = "countdown",
  className = "",
}: {
  value: string;
  ariaLabel?: string;
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const tickRef = React.useRef<any>(null);

  // Montaje único del "tick" (maneja StrictMode y doble render en dev)
  React.useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const mod = await import("@pqina/flip");
        const Tick: any = (mod as any).default ?? (mod as any);

        const host = hostRef.current;
        if (!host || disposed) return;

        if (host.dataset.tickMounted === "1") return; // evita doble montaje
        host.dataset.tickMounted = "1";

        // Marcado mínimo requerido por Tick/Flip
        host.innerHTML = `
          <div class="tick" aria-label="${ariaLabel}">
            <div data-repeat="true" aria-hidden="true">
              <span data-view="flip"></span>
            </div>
          </div>
        `;

        const el = host.querySelector(".tick") as HTMLElement;
        const tick = Tick.DOM.create(el);
        // Inicializa con algo para que no parpadee
        tick.value = value ?? "00:00";

        tickRef.current = tick;
      } catch (e) {
        console.error("FlipDigits init failed:", e);
      }
    })();

    return () => {
      disposed = true;
      try { tickRef.current?.destroy?.(); } catch {}
      const host = hostRef.current;
      if (host) delete host.dataset.tickMounted;
    };
  }, []);

  // Empuja el nuevo valor al flip cada vez que cambie `value`
  React.useEffect(() => {
    if (tickRef.current) {
      try {
        tickRef.current.value = value;
      } catch (e) {
        console.error("FlipDigits assign value failed:", e);
      }
    }
  }, [value]);

  return (
    <div ref={hostRef} className={className}>
      {/* Variables de estilo “inline” para que puedas tunear desde fuera con Tailwind via [style] */}
      <style jsx>{`
  :global(.tick) { font-size: var(--tick-fs, 1rem); line-height: 1; }
  :global(.tick .tick-flip) { 
    border-radius: var(--tick-radius, .5rem); 
    background: var(--tick-bg, #303030); 
    overflow: hidden;          /* evita ver debajo */
  }
  :global(.tick .tick-flip-panel) { 
    padding: var(--tick-pad-y, .12em) var(--tick-pad-x, .6ch);
    background: var(--tick-bg, #303030); /* fuerza fondo sólido */
  }
  :global(.tick-group) { margin-right: var(--tick-gap, .35rem); }
`}</style>
    </div>
  );
}
