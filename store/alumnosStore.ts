// store/alumnosStore.ts
"use client";

import { proxy, subscribe } from "valtio";

export type Alumno = {
  id: string;
  nombre: string;
  apellidos: string;
  mail?: string | null;
};

type Estado = {
  porCurso: Record<string, Alumno[]>;
  loading: Record<string, boolean>;
};

export const alumnosStore = proxy<Estado>({
  porCurso: {},
  loading: {},
});

// ---------- helpers de lectura/escritura ----------
export const getAlumnosDeCurso = (cursoId: string): Alumno[] =>
  alumnosStore.porCurso[cursoId] ?? [];

export const setAlumnosCurso = (cursoId: string, alumnos: Alumno[]) => {
  // Orden estable Apellidos + Nombre, tolerante a undefined/null
  const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const sorted = (alumnos ?? []).slice().sort((a, b) => {
    const A = `${norm(a.apellidos)} ${norm(a.nombre)}`.trim();
    const B = `${norm(b.apellidos)} ${norm(b.nombre)}`.trim();
    return A.localeCompare(B, "es", { sensitivity: "base" });
  });

  alumnosStore.porCurso[cursoId] = sorted;
};

// ---------- integración con preload ----------
function resolveIPC():
  | ((cursoId: string) => Promise<Alumno[]>)
  | null {
  if (typeof window === "undefined") return null;

  const api = (window as any)?.electronAPI;
  if (!api) {
    console.error("[alumnosStore] window.electronAPI es undefined (¿contextIsolation/preload?)");
    return null;
  }

  const fn =
    api.obtenerAlumnosPorCurso ??
    api.leerAlumnosPorCurso ??
    api.getAlumnosPorCurso ??
    api.alumnosPorCurso ??
    null;

  if (!fn) {
    console.error(
      "[alumnosStore] electronAPI no expone obtenerAlumnosPorCurso (ni alias). Keys:",
      Object.keys(api ?? {})
    );
    return null;
  }
  return fn as (cursoId: string) => Promise<Alumno[]>;
}

/** Carga por IPC si no hay cache o si force=true */
export const cargarAlumnosCurso = async (cursoId: string, force = false) => {
  if (!cursoId) return;
  if (!force && alumnosStore.porCurso[cursoId]?.length) return;

  alumnosStore.loading[cursoId] = true;
  try {
    const fn = resolveIPC();
    if (!fn) {
      setAlumnosCurso(cursoId, []);
      return;
    }
    const alumnos = await fn(String(cursoId));
    setAlumnosCurso(cursoId, alumnos ?? []);
  } catch (err) {
    console.error("[alumnosStore] Error IPC obtener alumnos:", err);
    setAlumnosCurso(cursoId, []);
  } finally {
    delete alumnosStore.loading[cursoId];
  }
};

export const refrescarAlumnosCurso = (cursoId: string) =>
  cargarAlumnosCurso(cursoId, true);

// Util por si necesitas limpiar el cache (p.ej., al cambiar de base de datos)
export const clearAlumnosCurso = (cursoId?: string) => {
  if (cursoId) {
    delete alumnosStore.porCurso[cursoId];
    delete alumnosStore.loading[cursoId];
  } else {
    alumnosStore.porCurso = {};
    alumnosStore.loading = {};
  }
};

// Debug opcional
subscribe(alumnosStore, () => {
  // console.debug("[alumnosStore] changed", alumnosStore);
});
