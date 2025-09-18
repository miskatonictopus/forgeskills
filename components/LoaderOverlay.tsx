"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

// ✅ Loader “spokes” oficial (size en píxeles)
import { Loader as ShadcnLoader } from "../src/components/ui/shadcn-io/ai/loader";

type LoaderOverlayProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  lines?: string[];
  progress?: { current: number; total: number } | null;
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

  React.useEffect(() => {
    if (!strictBlock || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, strictBlock]);

  React.useEffect(() => {
    if (!strictBlock || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (onClose && e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (["Tab", "Enter", " "].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, strictBlock, onClose]);

  React.useEffect(() => {
    if (!open) { setIdx(0); return; }
    if (progress && progress.total > 0) {
      const next = Math.max(0, Math.min(lines.length - 1, progress.current - 1));
      setIdx(next);
      return;
    }
    if (lines.length <= 1) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % lines.length), rotateIntervalMs);
    return () => window.clearInterval(t);
  }, [open, progress?.current, progress?.total, lines, rotateIntervalMs]);

  if (!mounted) return null;

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  // 🔁 Mapea tu prop ("sm|md|lg|xl") → píxeles para el loader “spokes”
  const sizePx: Record<"sm" | "md" | "lg" | "xl", number> = {
    sm: 16, md: 24, lg: 32, xl: 48,
  };
  

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            onClick={onClose ? () => onClose() : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${zIndexClassName} bg-background/60 ${blurClass[blur]} cursor-wait`}
            aria-hidden="true"
          />

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
              {/* ✅ Loader oficial “spokes” */}
              <ShadcnLoader size={sizePx[loaderSize ?? "lg"]} className="text-foreground" />

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
