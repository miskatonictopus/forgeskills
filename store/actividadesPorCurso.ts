// store/actividadesPorCurso.ts
"use client";

import { proxy } from "valtio";

/* ===== Tipos ===== */
// Lo que puede venir de la DB (mantenemos compat con “enviada/pendiente”)
export type EstadoDB =
  | "borrador"
  | "analizada"
  | "programada"
  | "enviada"
  | "pendiente"
  | "pendiente_evaluar"
  | "evaluada"
  | "cerrada";

// Estados unificados para UI
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

  estado?: EstadoDB;              // ← valor real de BDD
  analisisFecha?: string | null;
  umbralAplicado?: number | null;

  // pueden venir en snake_case desde backend
  programadaPara?: string | null; // "YYYY-MM-DD HH:mm" o "YYYY-MM-DDTHH:mm"
  programadaFin?: string | null;

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

// Mapa de estado DB → estado UI
const MAPA_DB_A_UI: Record<string, EstadoUI> = {
  borrador: "borrador",
  analizada: "analizada",
  programada: "programada",
  enviada: "pendiente_evaluar",          // compat
  pendiente: "pendiente_evaluar",        // compat
  pendiente_evaluar: "pendiente_evaluar",
  evaluada: "evaluada",
  cerrada: "cerrada",
};

/**
 * Estado visible para UI.
 * REGLA: si existe `estado` desde BDD → manda SIEMPRE.
 * Si NO existe `estado`, entonces inferimos por `programadaPara`.
 */
export function estadoUI(a: Actividad): EstadoUI {
  const raw = a.estado?.toLowerCase();
  if (raw && MAPA_DB_A_UI[raw]) return MAPA_DB_A_UI[raw];

  // Sólo si no viene `estado` desde DB, inferimos por horario
  if (a.programadaPara) return "programada";
  return "borrador";
}

/** "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" (sin tocar zona horaria) */
const asLocalDateTime = (s?: string | null) =>
  !s ? undefined : s.includes(" ") ? s.replace(" ", "T") : s;

/** Calendario */
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
  const programadaFin = raw.programadaFin ?? raw.programada_fin ?? null;

  const act: Actividad = {
    ...raw,
    programadaPara,
    programadaFin,
  };

  // canon = estado real si existe; si no, derivado
  return {
    ...act,
    estadoCanon: estadoUI(act),
  };
}

/* ===== Carga / Mutaciones ===== */

/** Carga TODAS las actividades del curso (usa tu IPC actual) */
export async function cargarActividades(cursoId: string) {
  const filas = await window.electronAPI.actividadesDeCurso(cursoId);
  const normalizadas = (filas as any[]).map(normalizaFila);
  actividadesPorCurso[cursoId] = normalizadas;
}

/** Carga/refresh SOLO de una asignatura, reemplazando su bloque dentro del curso */
export async function cargarActividadesPorAsignatura(cursoId: string, asignaturaId: string) {
  const filas = await window.electronAPI.listarActividadesPorAsignatura(cursoId, asignaturaId);
  const normalizadas = (filas as any[]).map(normalizaFila);

  const prev = actividadesPorCurso[cursoId] || [];
  actividadesPorCurso[cursoId] = [
    ...prev.filter((a) => a.asignaturaId !== asignaturaId),
    ...normalizadas,
  ];
}

/** Añadir una actividad nueva al curso (estadoCanon consistente) */
export function añadirActividad(cursoId: string, actividad: Actividad) {
  const list = actividadesPorCurso[cursoId] || [];
  const act = { ...actividad, estadoCanon: estadoUI(actividad) };
  actividadesPorCurso[cursoId] = [...list, act];
}

/** Mutación optimista tras programar por IPC */
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
      // OJO: no pisamos `estado` si viene de DB; aquí solo ajustamos el canónico
      estadoCanon: "programada",
    };
    actividadesPorCurso[cursoId] = [...list]; // trigger reactividad
  }
}
