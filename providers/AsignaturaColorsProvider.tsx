"use client";
import React from "react";

type Ctx = {
  getColor?: (id: string) => string | undefined;
  setColor?: (id: string, hex: string) => Promise<void> | void;
  ensureColor?: (id: string) => Promise<string | undefined>;
};

const Ctx = React.createContext<Ctx>({});

function normalizeHex(v?: string | null) {
  if (!v) return "";
  let s = String(v).trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}
function canon(id: string) {
  const raw = String(id);
  const slim = raw.replace(/^0+/, "") || "0";
  return { raw, slim };
}

export function AsignaturaColorsProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = React.useState<Record<string, string>>({});

  // Carga inicial de todos los colores (si existe el IPC)
  React.useEffect(() => {
    (async () => {
      try {
        const api = (window as any).electronAPI;
        const rows = await api?.listarColoresAsignaturas?.(); // [{id, color}]
        if (!rows) return;
        const next: Record<string, string> = {};
        for (const r of rows) {
          const hex = normalizeHex(r?.color);
          if (!hex) continue;
          const { raw, slim } = canon(String(r.id));
          next[raw] = hex;
          next[slim] = hex;
        }
        setMap(next);
      } catch {
        /* noop */
      }
    })();
  }, []);

  const getColor = React.useCallback((id: string) => {
    const { raw, slim } = canon(id);
    return map[raw] || map[slim];
  }, [map]);

  // Guardar + emitir evento global (opcional; ya lo usas en CursoCard)
  const setColor = React.useCallback(async (id: string, hex: string) => {
    const c = normalizeHex(hex);
    if (!c) return;
    const { raw, slim } = canon(id);
    setMap(prev => (prev[raw] === c || prev[slim] === c) ? prev : { ...prev, [raw]: c, [slim]: c });
    try {
      await (window as any).electronAPI?.actualizarColorAsignatura?.(raw, c);
    } catch {}
    window.dispatchEvent(new CustomEvent("asignatura:color:actualizado", {
      detail: { asignaturaId: raw, color: c }
    }));
  }, []);

  // ✅ Nuevo: si no está en memoria, lo trae de SQLite y actualiza el mapa
  const ensureColor = React.useCallback(async (id: string) => {
    const got = getColor(id);
    if (got) return got;
    try {
      const api = (window as any).electronAPI;
      const det = await (api?.leerAsignatura?.(id) ?? api?.getAsignatura?.(id));
      const hex = normalizeHex(det?.color);
      if (hex) {
        const { raw, slim } = canon(id);
        setMap(prev => ({ ...prev, [raw]: hex, [slim]: hex }));
        return hex;
      }
    } catch {}
    return undefined;
  }, [getColor]);

  return (
    <Ctx.Provider value={{ getColor, setColor, ensureColor }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAsignaturaColor() {
  return React.useContext(Ctx);
}
