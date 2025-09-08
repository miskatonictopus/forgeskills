// electronAPI.d.ts
import type { Curso } from "@/models/curso";
import type { Asignatura } from "@/models/asignatura";
import type { Alumno, AlumnoEntrada } from "@/models/alumno";
import type { Horario } from "@/models/horario";
import type { Actividad } from "@/store/actividadesPorCurso";

/* =============================
 * Tipos base
 * ============================= */
export type RangoLectivo = { start: string; end: string }; // "YYYY-MM-DD"

export type Festivo = {
  id: string;
  start: string;
  end: string | null;
  title: string;
};
export type FestivoCreate = { start: string; end?: string | null; title: string };

export type GuardarActividadPayload = {
  id: string;
  nombre: string;
  fecha: string; // "YYYY-MM-DD"
  cursoId: string;
  asignaturaId: string;
  descripcion?: string | null;
};
export type GuardarActividadResult = { ok: boolean; error?: string };

export type FCTTramo = {
  id: string;
  diaSemana: number;   // 1..5
  horaInicio: string;  // "HH:MM"
  horaFin: string;     // "HH:MM"
};

export type Presencialidad = {
  id: string;
  diaSemana: number;   // 1..5 (L..V)
  horaInicio: string;  // "HH:MM"
  horaFin: string;     // "HH:MM"
};

type ActividadProgramarPayload = {
  actividadId: string;
  startISO: string;     // "YYYY-MM-DD HH:mm"
  duracionMin: number;  // múltiplos de 60 (según tu main)
};

type ActividadProgramarResult = {
  ok: boolean;
  success: boolean;
  startISO?: string;
  endISO?: string;
  error?: string;
};

type AnalisisActividadSnapshot = {
  umbral: number;
  fecha: string | null;
  ces: Array<{
    codigo: string;
    puntuacion: number;
    reason?: "evidence" | "high_sim" | "lang_rule";
    evidencias?: string[];
  }>;
};

export type LectivoRange = { start?: string; end?: string } | null;

/* =============================
 * API expuesta en window.electronAPI
 * ============================= */
export interface ElectronAPI {
  /* ===== Cursos ===== */
  leerCursos: () => Promise<Curso[]>;
  guardarCurso: (curso: Curso) => Promise<void>;
  borrarCurso: (id: string) => Promise<void>;
  forzarRevisionEstados: () => Promise<number>;

  /* ===== Asignaturas ===== */
  leerAsignaturas: () => Promise<Asignatura[]>;
  leerAsignatura: (id: string) => Promise<any>;
  guardarAsignatura: (asignatura: any) => Promise<void>;
  actualizarColorAsignatura: (id: string, color: string) => Promise<void>;
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) => Promise<void>;
  asignaturasDeCurso: (cursoId: string) => Promise<{ id: string; nombre: string }[]>;
  leerAsignaturasCurso: (cursoId: string) => Promise<{ id: string; nombre: string; color?: string | null }[]>;

  /* ===== Eventos/IPC de actividades ===== */
  onActividadesActualizadas: (
    callback: (payload: { count: number }) => void
  ) => () => void;

  /* ===== Alumnos ===== */
  leerAlumnos: () => Promise<Alumno[]>;
  leerAlumnosPorCurso: (cursoId: string) => Promise<Alumno[]>;
  guardarAlumno: (alumno: AlumnoEntrada) => Promise<void>;
  obtenerAlumnosPorCurso: (cursoId: string) => Promise<
    { id: string; nombre: string; apellidos: string }[]
  >;
  alumnosPorCurso: (
    cursoId: string
  ) => Promise<{ id: string; nombre: string; apellidos: string }[]>;

  /* ===== Actividades ===== */
  guardarActividad: (payload: GuardarActividadPayload) => Promise<GuardarActividadResult>;
  actividadesDeCurso: (cursoId: string) => Promise<Actividad[]>;
  listarActividadesPorAsignatura: (cursoId: string, asignaturaId: string) => Promise<any[]>;
  listarActividadesGlobal: () => Promise<Array<{
    id: string;
    nombre: string;
    fecha: string;
    descripcion?: string | null;
    cursoId?: string | null;
    cursoNombre?: string | null;
    asignaturaId?: string | null;
    asignaturaNombre?: string | null;
    horaInicio?: string | null;
    horaFin?: string | null;
  }>>;
  actualizarActividadFecha: (id: string, fecha: string) => Promise<{ ok: boolean }>;
  borrarActividad: (actividadId: string) => Promise<void>;
  evaluarActividad: (
    actividadId: string,
    notas: { alumnoId: string; nota: number }[]
  ) => Promise<{ ok: boolean }>;
  evaluarYPropagarActividad: (actividadId: string) => Promise<{ ok: boolean }>;
  guardarNotasActividad: (actividadId: string, notas: { alumnoId: string; nota: number }[]) => Promise<{ ok: true }>;

  /* ===== RA/CE ===== */
  obtenerRAPorAsignatura: (asignaturaId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;
  obtenerCEPorRA: (raId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;
  guardarAsignaturaEImportarRAyCE: (
    asignaturaId: string,
    raList: Array<{
      codigo: string;
      descripcion: string;
      CE: Array<{ codigo: string; descripcion: string }>;
    }>
  ) => Promise<{ ok: boolean; raCount: number; ceCount: number }>;
  cePorAsignatura: (
    asignaturaId: string
  ) => Promise<Array<{ ceCodigo: string; descripcion: string; raCodigo: string }>>;

  /* ===== Horarios ===== */
  leerHorarios: (asignaturaId: string, cursoId?: string) => Promise<Array<{
    id: number | string;
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }>>;
  leerHorariosTodos: () => Promise<Horario[]>;
  guardarHorario: (data: {
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }) => Promise<any>;
  borrarHorario: (data: {
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
  }) => Promise<{ changes: number }>;
  getHorariosAsignatura: (cursoId: string, asignaturaId: string) => Promise<
    { diaSemana: number; horaInicio: string; horaFin: string }[]
  >;
  horariosDeAsignatura: (params: { cursoId: string; asignaturaId: string }) =>
    Promise<Array<{ diaSemana: number; horaInicio: string; horaFin: string }>>;

  /* ===== Calendario / Lectivo / Festivos / Presencialidades / FCT ===== */
  leerRangoLectivo: () => Promise<RangoLectivo | null>;
  guardarRangoLectivo: (r: RangoLectivo) => Promise<{ ok: boolean } | void>;

  listarFestivos: () => Promise<Festivo[]>;
  crearFestivo: (f: FestivoCreate) => Promise<Festivo>;
  borrarFestivo: (id: string) => Promise<{ ok: boolean }>;

  listarPresencialidades: () => Promise<Presencialidad[]>;
  crearPresencialidad: (p: { diaSemana: number; horaInicio: string; horaFin: string }) => Promise<Presencialidad>;
  borrarPresencialidad: (id: string) => Promise<{ ok: boolean }>;

  listarFCT: () => Promise<FCTTramo[]>;
  crearFCT: (p: { diaSemana: number; horaInicio: string; horaFin: string }) => Promise<FCTTramo>;
  borrarFCT: (id: string) => Promise<{ ok: boolean }>;

  /* ===== Análisis / PDF ===== */
  analizarDescripcion: (actividadId: string) => Promise<CEDetectado[]>;
  analizarDescripcionDesdeTexto: (texto: string, asignaturaId: string) => Promise<any>;
  extraerTextoPDF: (rutaPDF: string) => Promise<string | null>;
  guardarPDF: (buffer: ArrayBuffer, filename: string) => Promise<string>;
  exportarPDFDesdeHTML: (html: string, fileName: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  guardarInformePDF: (data: Uint8Array, sugerido: string) => Promise<{ ok: boolean; filePath?: string }>;
  guardarAnalisisActividad: (
    actividadId: string,
    umbral: number,
    ces: { codigo: string; puntuacion: number; reason?: "evidence" | "high_sim" | "lang_rule"; evidencias?: string[] }[]
  ) => Promise<{ ok: boolean }>;
  leerAnalisisActividad: (actividadId: string) => Promise<AnalisisActividadSnapshot>;

  /* ===== Planificación Didáctica ===== */
  calcularHorasReales: (opts?: {
    cursoId?: string;
    asignaturaId?: string;
    desde?: string; // YYYY-MM-DD
    hasta?: string; // YYYY-MM-DD
    incluirFechas?: boolean;
  }) => Promise<{
    desde: string;
    hasta: string;
    festivos: { inicio: string; fin: string; descripcion?: string }[];
    items: Array<{
      cursoId: string | null;
      asignaturaId: string;
      asignaturaNombre: string;
      sesiones: number;
      minutos: number;
      horas: number;
      fechas?: string[];
    }>;
    totalHoras: number;
  }>;

  guardarProgramacionDidactica: (payload: {
    asignaturaId: string;
    cursoId: string;
    generadoEn: string;
    totalSesiones: number;
    sesiones: Array<{
      indice: number;
      fecha?: string;
      items: Array<
        | { tipo: "ce"; raCodigo: string; ceCodigo: string; ceDescripcion: string; dificultad?: number; minutos?: number }
        | { tipo: "eval"; raCodigo: string; titulo: string }
      >;
    }>;
    planLLM?: any;
    meta?: { asignaturaNombre?: string; cursoNombre?: string };
    modeloLLM?: "gpt-4o" | "gpt-4o-mini" | null;
    replacePrev?: boolean;
    materializarActividades?: boolean;
  }) => Promise<{ ok: boolean; id?: string; error?: string; resumen?: any }>;

  /* ===== Utilidades UX (opcional pero útil) ===== */
  revelarEnCarpeta?: (fullPath: string) => Promise<void>;

  exportarProgramacionPDF(
    html: string,
    jsonPath: string
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }>;
}

/* =============================
 * Globals
 * ============================= */
declare global {
  type CEDetectado = {
    codigo: string;
    descripcion: string;
    puntuacion: number; // 0..1
    reason?: "evidence" | "high_sim" | "lang_rule";
    evidencias?: string[];
  };

  interface Window {
    electronAPI: ElectronAPI; // único global ✅
  }
}

export {};
