"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type LoaderOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  lines?: string[];
  progress?: { current: number; total: number } | null;
  blur?: "sm" | "md" | "lg" | "xl";
  onClose?: () => void; // si lo pasas, se permite cerrar con ESC
  zIndexClassName?: string;
  /** Bloquea scroll del body y teclas mientras esté abierto */
  strictBlock?: boolean;
};

const blurClass = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
};

export default function LoaderOverlay({
  open,
  title = "Generando…",
  subtitle,
  lines,
  progress,
  blur = "md",
  onClose,
  zIndexClassName = "z-[1200]",
  strictBlock = true,
}: LoaderOverlayProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Bloquear scroll del body
  React.useEffect(() => {
    if (!strictBlock) return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, strictBlock]);

  // Bloquear teclas (excepto ESC si hay onClose)
  React.useEffect(() => {
    if (!strictBlock || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (onClose && e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Evita que Tab/Enter/Space/etc. actúen en el fondo
      e.stopPropagation();
      if (["Tab", "Enter", " "].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, strictBlock, onClose]);

  if (!mounted) return null;

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop - BLOQUEA CLICS (no tiene onClick si no quieres cerrar) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${zIndexClassName} bg-background/60 ${blurClass[blur]} cursor-wait`}
            aria-hidden="true"
            // si no pasas onClose, esto simplemente consume el click y bloquea todo
            onClick={onClose ? () => onClose() : undefined}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4 pointer-events-none`}
          >
            <div
              className="pointer-events-auto w-full max-w-lg rounded-2xl border bg-card/90 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary mt-[2px]" />
                <div className="flex-1">
                  <h3 className="font-semibold leading-tight">{title}</h3>
                  {subtitle ? (
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                  ) : null}
                </div>
                {onClose ? (
                  <button
                    onClick={onClose}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    ESC
                  </button>
                ) : null}
              </div>

              {percent !== null ? (
                <div className="px-4">
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

              {Array.isArray(lines) && lines.length > 0 ? (
                <div className="px-4 pb-4 pt-2">
                  <ul className="space-y-1.5">
                    {lines.map((text, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="text-sm"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" />
                          <span className="text-foreground/90">{text}</span>
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="px-4 pb-4 pt-2">
                  <SkeletonLine />
                  <SkeletonLine className="w-5/6" />
                  <SkeletonLine className="w-2/3" />
                </div>
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function SkeletonLine({ className = "w-full" }: { className?: string }) {
  return (
    <div className={`h-3 ${className} rounded bg-muted relative overflow-hidden`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
