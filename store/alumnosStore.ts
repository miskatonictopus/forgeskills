"use client";

import { proxy, subscribe } from "valtio";

export type Alumno = {
  id: string;
  nombre: string;
  apellidos: string;
  mail?: string;
};

type Estado = {
  porCurso: Record<string, Alumno[]>;
  loading: Record<string, boolean>;
};

export const alumnosStore = proxy<Estado>({
  porCurso: {},
  loading: {},
});

export const getAlumnosDeCurso = (cursoId: string): Alumno[] =>
  alumnosStore.porCurso[cursoId] ?? [];

export const setAlumnosCurso = (cursoId: string, alumnos: Alumno[]) => {
  alumnosStore.porCurso[cursoId] = (alumnos ?? []).sort((a, b) =>
    (a?.apellidos + a?.nombre).localeCompare(b?.apellidos + b?.nombre, "es")
  );
};

// --- util interno: resuelve la función expuesta por preload ---
function resolveAlumnosFn(): null | ((cursoId: string) => Promise<Alumno[]>) {
  const api = (window as any)?.electronAPI;
  if (!api) {
    console.error("[alumnosStore] window.electronAPI es undefined (¿estás fuera de Electron?)");
    return null;
  }

  const fn =
    api.obtenerAlumnosPorCurso ??
    api.leerAlumnosPorCurso ?? // alias
    api.getAlumnosPorCurso ??  // por si existe con este nombre
    api.alumnosPorCurso;       // último intento

  if (!fn) {
    console.error(
      "[alumnosStore] electronAPI no expone obtener/leER/getAlumnosPorCurso. Keys disponibles:",
      Object.keys(api ?? {})
    );
    return null;
  }

  return fn as (cursoId: string) => Promise<Alumno[]>;
}

/** Carga por IPC si no existen o si force=true */
export const cargarAlumnosCurso = async (cursoId: string, force = false) => {
  if (!force && alumnosStore.porCurso[cursoId]?.length) return;

  alumnosStore.loading[cursoId] = true;
  try {
    const fn = resolveAlumnosFn();
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
    alumnosStore.loading[cursoId] = false;
  }
};

export const refrescarAlumnosCurso = (cursoId: string) => cargarAlumnosCurso(cursoId, true);

subscribe(alumnosStore, () => {
  // console.debug("alumnosStore changed", alumnosStore);
});
