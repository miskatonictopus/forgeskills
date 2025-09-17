"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";


/** ===== Loader estilo shadcn/ai (anillo) ===== */
function ShadcnLoaderOfficial({
    size = "lg",
    className = "",
  }: {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
  }) {
    const sizeMap = {
      sm: "h-6 w-6 border-2",
      md: "h-8 w-8 border-2",
      lg: "h-12 w-12 border-[3px]",
      xl: "h-16 w-16 border-4",
    } as const;
  
    return (
      <span aria-hidden className={`relative inline-block ${className}`}>
        {/* anillo base */}
        <span className={`block rounded-full border-current/30 ${sizeMap[size]} border`} />
        {/* anillo animado (borde superior transparente) */}
        <span
          className={`absolute inset-0 rounded-full border-t-transparent border-current animate-spin ${sizeMap[size]} border`}
        />
      </span>
    );
  }

type LoaderOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  /** Mensajes/estados que se irán mostrando de uno en uno */
  lines?: string[];
  /** Control externo del avance: current (1..total) */
  progress?: { current: number; total: number } | null;
  /** Si no hay progress, el mensaje rota cada X ms */
  rotateIntervalMs?: number;
  blur?: "sm" | "md" | "lg" | "xl";
  onClose?: () => void;
  zIndexClassName?: string;
  strictBlock?: boolean;
  loaderSize?: "sm" | "md" | "lg" | "xl";
};

const blurClass = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
};

export default function LoaderOverlay({
  open,
  title = "Preparando…",
  subtitle,
  lines = [],
  progress,
  rotateIntervalMs = 1200,
  blur = "lg",
  onClose,
  zIndexClassName = "z-[1200]",
  strictBlock = true,
  loaderSize = "lg",
}: LoaderOverlayProps) {
  const [mounted, setMounted] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => setMounted(true), []);

  // Bloquear scroll
  React.useEffect(() => {
    if (!strictBlock || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, strictBlock]);

  // Teclas: permitir ESC si hay onClose
  React.useEffect(() => {
    if (!strictBlock || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (onClose && e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (["Tab", "Enter", " "].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, strictBlock, onClose]);

  // Índice del mensaje: controlado por progress o rotación automática
  React.useEffect(() => {
    if (!open) {
      setIdx(0);
      return;
    }
    if (progress && progress.total > 0) {
      const next = Math.max(0, Math.min(lines.length - 1, progress.current - 1));
      setIdx(next);
      return;
    }
    // Auto-rotación si no hay progress
    if (lines.length <= 1) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % lines.length);
    }, rotateIntervalMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, progress?.current, progress?.total, lines, rotateIntervalMs]);

  if (!mounted) return null;

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            onClick={onClose ? () => onClose() : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${zIndexClassName} bg-background/60 ${blurClass[blur]} cursor-wait`}
            aria-hidden="true"
          />

          {/* Contenido */}
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-6`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="pointer-events-none flex w-full max-w-3xl flex-col items-center text-center">
            <ShadcnLoaderOfficial size={loaderSize} className="text-foreground" />
              {/* Títulos */}
              <div className="mt-4 space-y-1">
                <h3 className="pointer-events-auto text-base font-semibold leading-tight">
                  {title}
                </h3>
                {subtitle ? (
                  <p className="pointer-events-auto text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              {/* Progreso (opcional) */}
              {percent !== null ? (
                <div className="mt-4 w-full max-w-lg">
                  <div className="h-2 w-full rounded bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ type: "spring", stiffness: 140, damping: 20 }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {progress!.current}/{progress!.total} ({percent}%)
                  </div>
                </div>
              ) : null}

              {/* Mensaje centrado con fade in/out */}
              <div className="mt-8 min-h-[2.25rem] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {lines[idx] ? (
                    <motion.p
                      key={`msg-${idx}-${lines[idx]}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.28 }}
                      className="text-sm text-foreground/90"
                    >
                      {lines[idx]}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Pista ESC */}
              {onClose ? (
                <div className="mt-6 text-[11px] text-muted-foreground">Pulsa ESC para cancelar</div>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
