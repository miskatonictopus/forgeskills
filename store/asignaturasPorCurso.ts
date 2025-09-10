"use client";
import { proxy } from "valtio";

export type CE = { codigo: string; descripcion: string };
export type RA = { codigo: string; descripcion: string; CE: CE[] };

export type Asignatura = {
  id: string;
  nombre: string;
  codigo?: string;          // 👈 lo añadimos (útil para RA/CE)
  color?: string | null;
  RA?: RA[];
};

type Store = {
  asignaturasPorCurso: Record<string, Asignatura[]>;
  setAsignaturasCurso: (cursoId: string, asignaturas?: Asignatura[] | null) => void;
  setColorAsignatura: (asignaturaId: string, color: string | null) => void;
};

export const store = proxy<Store>({
  asignaturasPorCurso: {},

  setAsignaturasCurso(cursoId, asignaturas) {
    const safe = (asignaturas ?? []).map((a) => ({
      ...a,
      // normalizamos por si vienen otras claves desde IPC
      id: a.id,
      nombre: a.nombre,
      codigo: (a as any).codigo ?? (a as any).code ?? a.id,
      color: a.color ?? null,
    }));
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

// 🔄 Carga desde IPC (usa el nombre EXACTO que expone preload)
export async function cargarAsignaturas(cursoId: string) {
  try {
    const api = (window as any).electronAPI;
    // prioridad al nombre nuevo; fallback al antiguo si existiera
    const listar =
      api?.asignaturasDeCurso ??
      api?.leerAsignaturas ??
      null;

    if (!listar) {
      console.error("[asignaturasPorCurso] No existe electronAPI.asignaturasDeCurso/leerAsignaturas");
      setAsignaturasCurso(cursoId, []);
      return;
    }

    const asignaturas = await listar(cursoId);
    setAsignaturasCurso(cursoId, asignaturas ?? []);
  } catch (err) {
    console.error("Error cargando asignaturas del curso:", err);
    setAsignaturasCurso(cursoId, []); // evitar null
  }
}
