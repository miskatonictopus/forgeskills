"use client";

import { proxy, subscribe } from "valtio";

export type Alumno = {
  id: string;
  nombre: string;
  apellidos: string;
  // opcionalmente: email, avatar, etc.
};

type Estado = {
  // mapa cursoId -> lista de alumnos
  porCurso: Record<string, Alumno[]>;
  // loading flags sencillos
  loading: Record<string, boolean>;
};

export const alumnosStore = proxy<Estado>({
  porCurso: {},
  loading: {},
});

/** Devuelve la lista (o []) ya normalizada */
export const getAlumnosDeCurso = (cursoId: string): Alumno[] =>
  alumnosStore.porCurso[cursoId] ?? [];

/** Setter directo por si hidratas desde SSR/IPC */
export const setAlumnosCurso = (cursoId: string, alumnos: Alumno[]) => {
  alumnosStore.porCurso[cursoId] = alumnos.sort((a, b) =>
    (a.apellidos + a.nombre).localeCompare(b.apellidos + b.nombre, "es")
  );
};

/** Carga por IPC si no existen o si force=true */
export const cargarAlumnosCurso = async (cursoId: string, force = false) => {
  if (!force && alumnosStore.porCurso[cursoId]?.length) return;
  alumnosStore.loading[cursoId] = true;
  try {
    const alumnos = await (window as any).electronAPI.obtenerAlumnosPorCurso(cursoId);
    setAlumnosCurso(cursoId, alumnos ?? []);
  } finally {
    alumnosStore.loading[cursoId] = false;
  }
};

/** Helper para refrescar tras cambios (p.ej. matrícula, baja, etc.) */
export const refrescarAlumnosCurso = (cursoId: string) => cargarAlumnosCurso(cursoId, true);

// opcional: mantén el store limpio si quieres depurar
subscribe(alumnosStore, () => {
  // console.debug("alumnosStore changed", alumnosStore);
});
