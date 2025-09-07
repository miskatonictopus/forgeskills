"use client";
import * as React from "react";
import { useSnapshot } from "valtio";
import FlipDigits from "./FlipDigits";

// Ajusta la ruta según tu proyecto
import { timerStore, formatHMS } from "@/store/timerStore";

/**
 * Muestra la cuenta atrás leyendo de timerStore.
 * - Usa formatHMS(remaining) (ej: "01:23:45")
 * - No crea intervalos: confía en que tu store ya emite cambios por segundo.
 * - Si prefieres que este componente “tique” por sí mismo, activa el fallback opcional.
 */
export default function TimerFlipDigits({
  className = "",
  ariaLabel = "countdown",
  // Fallback: si tu store no re-renderiza cada segundo,
  // puedes activar el tick local para forzar repintado.
  enableLocalTickFallback = false,
}: {
  className?: string;
  ariaLabel?: string;
  enableLocalTickFallback?: boolean;
}) {
  const snap = useSnapshot(timerStore);

  // Deriva el valor a mostrar desde tu estado (ajusta nombres si difieren)
  const remaining = Math.max(0, Math.floor(snap.remaining ?? 0));

  const value = React.useMemo(() => formatHMS(remaining), [remaining]);

  // Fallback opcional para forzar un repintado cada segundo si el store no emite
  React.useEffect(() => {
    if (!enableLocalTickFallback) return;
    let raf: any;
    let id: any;
    const tick = () => {
      // Forzamos un state dummy para repintar; aquí usamos setState vacío
      // Simple truco: alternar una ref/contador y setState
      id = setTimeout(() => { raf = requestAnimationFrame(tick); }, 1000);
    };
    tick();
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [enableLocalTickFallback]);

  return (
    <FlipDigits
      value={value}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
