"use client";
import { proxy } from "valtio";

export type Asignatura = { id: string; nombre: string; color?: string | null };

type Store = {
  asignaturasPorCurso: Record<string, Asignatura[]>;
  setAsignaturasCurso: (cursoId: string, asignaturas?: Asignatura[] | null) => void;
  setColorAsignatura: (asignaturaId: string, color: string | null) => void;
};

export const store = proxy<Store>({
  asignaturasPorCurso: {},

  // ⬇️ null-safe
  setAsignaturasCurso(cursoId, asignaturas) {
    const safe = asignaturas ?? [];
    const prev = store.asignaturasPorCurso[cursoId] ?? [];
    const prevById = Object.fromEntries(prev.map((a) => [a.id, a] as const));
    store.asignaturasPorCurso[cursoId] = safe.map((a) => ({
      ...a,
      color: a.color ?? prevById[a.id]?.color ?? null,
    }));
  },

  setColorAsignatura(asignaturaId, color) {
    for (const cid of Object.keys(store.asignaturasPorCurso)) {
      const arr = store.asignaturasPorCurso[cid];
      const idx = arr.findIndex((a) => a.id === asignaturaId);
      if (idx !== -1) arr[idx] = { ...arr[idx], color };
    }
  },
});

export const asignaturasPorCurso = store.asignaturasPorCurso;
export const setAsignaturasCurso = store.setAsignaturasCurso;

// 🔄 Carga desde IPC (usa el nombre EXACTO de preload: leerAsignaturasCurso)
export async function cargarAsignaturas(cursoId: string) {
  try {
    const asignaturas = await window.electronAPI.leerAsignaturasCurso(cursoId);
    setAsignaturasCurso(cursoId, asignaturas ?? []);
  } catch (err) {
    console.error("Error cargando asignaturas del curso:", err);
    setAsignaturasCurso(cursoId, []); // evitar null
  }
}
