"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

/**
 * Envuelve la app y hace un fade-out/fade-in suave cuando cambia el tema.
 * No desmonta la UI; solo anima la opacidad del contenedor.
 */
export default function ThemeSmoothTransition({
  children,
  duration = 0.35,       // duración total aprox. (sugerencia: 0.3–0.45)
  minOpacity = 0.6,       // cuánta “oscurecida” durante el cruce (0–1)
}: {
  children: React.ReactNode;
  duration?: number;
  minOpacity?: number;
}) {
  const controls = useAnimation();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const lastThemeRef = useRef<string | undefined>(undefined);

  useEffect(() => setMounted(true), []);
  const current = (theme ?? resolvedTheme) as string | undefined;

  useEffect(() => {
    if (!mounted) return;
    const last = lastThemeRef.current;
    // Solo animar si el tema realmente cambió (evita animación al primer render)
    if (last && current && last !== current) {
      (async () => {
        // Fade out parcial
        await controls.start({ opacity: minOpacity, transition: { duration: duration * 1 } });
        // (El tema ya cambió; el usuario ve menos “golpe” por la opacidad baja)
        // Fade in
        await controls.start({ opacity: 1, transition: { duration: duration * 1 } });
      })();
    }
    lastThemeRef.current = current;
  }, [current, mounted, controls, duration, minOpacity]);

  if (!mounted) {
    // Evita FOUC al inicio
    return <div style={{ opacity: 0 }}>{children}</div>;
  }

  return (
    <motion.div initial={{ opacity: 1 }} animate={controls}>
      {children}
    </motion.div>
  );
}
