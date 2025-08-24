// store/actividadesPorCurso.ts
"use client";

import { proxy } from "valtio";

/* ===== Tipos ===== */
export type EstadoDB =
  | "borrador"
  | "analizada"
  | "programada"
  | "enviada"
  | "pendiente"
  | "pendiente_evaluar"
  | "evaluada"
  | "cerrada";

export type EstadoUI =
  | "borrador"
  | "analizada"
  | "programada"
  | "pendiente_evaluar"
  | "evaluada"
  | "cerrada";

export type Actividad = {
  id: string;
  nombre: string;
  fecha: string; // "YYYY-MM-DD" o ISO
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;
  notaMedia?: number | null; // ✅

  estado?: EstadoDB;              // valor real de DB
  analisisFecha?: string | null;  // mapeo de analisis_fecha
  umbralAplicado?: number | null;

  programadaPara?: string | null; // "YYYY-MM-DD HH:mm" o "YYYY-MM-DDTHH:mm"
  programadaFin?: string | null;

  evaluadaFecha?: string | null;  // ✅ nuevo: mapeo de evaluada_fecha

  // solo en memoria (UI)
  estadoCanon?: EstadoUI;
};

export type FCEvent = {
  id: string;
  title: string;
  start?: string | Date;
  end?: string | Date;
  allDay?: boolean;
  classNames?: string[];
  backgroundColor?: string;
  extendedProps?: Record<string, any>;
};

type ActividadesPorCurso = Record<string, Actividad[]>;
export const actividadesPorCurso = proxy<ActividadesPorCurso>({});

/* ===== Helpers ===== */


// Mapa estado DB → estado UI
const MAPA_DB_A_UI: Record<string, EstadoUI> = {
  borrador: "borrador",
  analizada: "analizada",
  programada: "programada",
  enviada: "pendiente_evaluar",   // compat
  pendiente: "pendiente_evaluar", // compat
  pendiente_evaluar: "pendiente_evaluar",
  evaluada: "evaluada",
  cerrada: "cerrada",
};

/** Estado visible en UI */
export function estadoUI(a: Actividad): EstadoUI {
  const raw = a.estado?.toLowerCase();
  if (raw && MAPA_DB_A_UI[raw]) return MAPA_DB_A_UI[raw];
  if (a.programadaPara) return "programada";
  return "borrador";
}

/** "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" */
const asLocalDateTime = (s?: string | null) =>
  !s ? undefined : s.includes(" ") ? s.replace(" ", "T") : s;

/** Convierte actividades → eventos calendario */
export function mapActividadesToFC(acts: Actividad[]): FCEvent[] {
  return acts
    .map((a) => {
      const start = asLocalDateTime(a.programadaPara);
      const end = asLocalDateTime(a.programadaFin);
      if (!start) return null;

      const ev = a.estadoCanon ?? estadoUI(a);
      return {
        id: a.id,
        title: a.nombre,
        start,
        end,
        allDay: false,
        classNames: [ev === "programada" ? "evt-programada" : "evt-borrador"],
        extendedProps: {
          cursoId: a.cursoId,
          asignaturaId: a.asignaturaId,
          estado: ev,
        },
      } as FCEvent;
    })
    .filter((e): e is FCEvent => e !== null);
}

export function eventosDeCurso(cursoId: string): FCEvent[] {
  const acts = actividadesPorCurso[cursoId] ?? [];
  return mapActividadesToFC(acts);
}

/* ===== Normalización ===== */
function normalizaFila(raw: any): Actividad {
  // compat snake_case → camelCase
  const programadaPara = raw.programadaPara ?? raw.programada_para ?? null;
  const programadaFin  = raw.programadaFin  ?? raw.programada_fin  ?? null;
  const analisisFecha  = raw.analisisFecha  ?? raw.analisis_fecha  ?? null; // ✅
  const evaluadaFecha  = raw.evaluadaFecha  ?? raw.evaluada_fecha  ?? null; // ✅
  const notaMedia = raw.notaMedia ?? raw.nota_media ?? null;

  const act: Actividad = {
    ...raw,
    programadaPara,
    programadaFin,
    analisisFecha,
    evaluadaFecha,
    notaMedia,
  };

  return {
    ...act,
    estadoCanon: estadoUI(act),
  };
}

/* ===== Carga / Mutaciones ===== */

/** Carga TODAS las actividades del curso */
export async function cargarActividades(cursoId: string) {
  const filas = await window.electronAPI.actividadesDeCurso(cursoId);
  const normalizadas = (filas as any[]).map(normalizaFila);
  actividadesPorCurso[cursoId] = normalizadas;
}

/** Carga SOLO actividades de una asignatura */
export async function cargarActividadesPorAsignatura(cursoId: string, asignaturaId: string) {
  const filas = await window.electronAPI.listarActividadesPorAsignatura(cursoId, asignaturaId);
  const normalizadas = (filas as any[]).map(normalizaFila);

  const prev = actividadesPorCurso[cursoId] || [];
  actividadesPorCurso[cursoId] = [
    ...prev.filter((a) => a.asignaturaId !== asignaturaId),
    ...normalizadas,
  ];
}

/** Añadir nueva actividad */
export function añadirActividad(cursoId: string, actividad: Actividad) {
  const list = actividadesPorCurso[cursoId] || [];
  const act = { ...actividad, estadoCanon: estadoUI(actividad) };
  actividadesPorCurso[cursoId] = [...list, act];
}

/** Mutación optimista tras programar */
export function setProgramadaEnMemoria(
  cursoId: string,
  actividadId: string,
  startISO: string,
  endISO?: string | null
) {
  const list = actividadesPorCurso[cursoId] || [];
  const i = list.findIndex((a) => a.id === actividadId);
  if (i >= 0) {
    const a = list[i];
    list[i] = {
      ...a,
      programadaPara: startISO,
      programadaFin: endISO ?? a.programadaFin ?? null,
      estadoCanon: "programada",
    };
    actividadesPorCurso[cursoId] = [...list];
  }
}

/** Mutación optimista tras analizar */
export function setAnalizadaEnMemoria(cursoId: string, actividadId: string) {
  const list = actividadesPorCurso[cursoId] || [];
  const i = list.findIndex((a) => a.id === actividadId);
  if (i >= 0) {
    const a = list[i];
    list[i] = {
      ...a,
      estado: "analizada",
      estadoCanon: "analizada",
      analisisFecha: new Date().toISOString(),
    };
    actividadesPorCurso[cursoId] = [...list];
  }
}

/** Mutación optimista tras evaluar */
export function setEvaluadaEnMemoria(cursoId: string, actividadId: string) {
  const list = actividadesPorCurso[cursoId] || [];
  const i = list.findIndex((a) => a.id === actividadId);
  if (i >= 0) {
    const a = list[i];
    list[i] = {
      ...a,
      estado: "evaluada",
      estadoCanon: "evaluada",
      evaluadaFecha: new Date().toISOString(), // ✅ camelCase
    };
    actividadesPorCurso[cursoId] = [...list];
  }
}

/** Mutación para marcar pendiente_evaluar */
export function setPendienteEvaluarEnMemoria(cursoId: string, actividadId: string) {
  const list = actividadesPorCurso[cursoId] || [];
  const i = list.findIndex((a) => a.id === actividadId);
  if (i >= 0) {
    const a = list[i];
    list[i] = {
      ...a,
      estado: "pendiente_evaluar",
      estadoCanon: "pendiente_evaluar",
    };
    actividadesPorCurso[cursoId] = [...list];
  }
}

/** Mutación tras cerrar */
export function setCerradaEnMemoria(cursoId: string, actividadId: string) {
  const list = actividadesPorCurso[cursoId] || [];
  const i = list.findIndex((a) => a.id === actividadId);
  if (i >= 0) {
    const a = list[i];
    list[i] = {
      ...a,
      estado: "cerrada",
      estadoCanon: "cerrada",
    };
    actividadesPorCurso[cursoId] = [...list];
  }
}
