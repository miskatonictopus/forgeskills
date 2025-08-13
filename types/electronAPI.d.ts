import type { Curso } from "@/models/curso";
import type { Asignatura } from "@/models/asignatura";
import type { Alumno, AlumnoEntrada } from "@/models/alumno";
import type { Horario } from "@/models/horario";
import type { Actividad } from "@/store/actividadesPorCurso";

// 🆕 Tipos calendario
export type RangoLectivo = { start: string; end: string };              // "YYYY-MM-DD"
export type Festivo = { id?: string; title: string; start: string; end?: string };

export interface ElectronAPI {
  // Cursos
  leerCursos: () => Promise<Curso[]>;
  guardarCurso: (curso: Curso) => Promise<void>;
  borrarCurso: (id: string) => Promise<void>;

  // Asignaturas
  leerAsignaturas: () => Promise<Asignatura[]>;
  leerAsignatura: (id: string) => Promise<any>;
  guardarAsignatura: (asignatura: Asignatura) => Promise<void>;
  actualizarColorAsignatura: (id: string, color: string) => Promise<void>;
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) => Promise<void>;
  asignaturasDeCurso: (cursoId: string) => Promise<{ id: string; nombre: string }[]>;

  // Alumnos
  leerAlumnos: () => Promise<Alumno[]>;
  leerAlumnosPorCurso: (cursoId: string) => Promise<Alumno[]>;
  guardarAlumno: (alumno: AlumnoEntrada) => Promise<void>;

  // Horarios
  leerHorarios(asignaturaId: string, cursoId?: string): Promise<Array<{
    id: number | string;
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }>>;
  leerHorariosTodos: () => Promise<Horario[]>;
  guardarHorario(data: {
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }): Promise<any>;
  borrarHorario(data: {
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
  }): Promise<{ changes: number }>;
  getHorariosAsignatura(cursoId: string, asignaturaId: string): Promise<
    { diaSemana: number; horaInicio: string; horaFin: string }[]
  >;

  // Actividades
  guardarActividad: (actividad: Actividad) => Promise<{ success: boolean }>;
  actividadesDeCurso: (cursoId: string) => Promise<Actividad[]>;
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

  // RA/CE
  obtenerRAPorAsignatura: (asignaturaId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;
  obtenerCEPorRA: (raId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;

  // Análisis / PDF
  analizarDescripcion: (actividadId: string) => Promise<CEDetectado[]>;
  analizarDescripcionDesdeTexto: (texto: string, asignaturaId: string) => Promise<any>;
  extraerTextoPDF: (rutaPDF: string) => Promise<string | null>;
  guardarPDF: (buffer: ArrayBuffer, filename: string) => Promise<string>;
  guardarInformePDF: (data: Uint8Array, sugerido: string) => Promise<{ ok: boolean; filePath?: string }>;
  guardarAnalisisActividad: (
    actividadId: string,
    umbral: number,
    ces: { codigo: string; puntuacion: number; reason?: "evidence" | "high_sim" | "lang_rule"; evidencias?: string[] }[]
  ) => Promise<{ ok: boolean }>;
  leerAnalisisActividad: (actividadId: string) => Promise<{ umbral: number; fecha: string | null; ces: CEDetectado[] }>;

  // 🆕 Calendario — rango lectivo y festivos (opcionales para no romper si aún no hay IPC)
  leerRangoLectivo?: () => Promise<RangoLectivo | null>;
  guardarRangoLectivo?: (r: RangoLectivo) => Promise<void>;
  listarFestivos?: () => Promise<Festivo[]>;

  leerRangoLectivo: () => Promise<RangoLectivo | null>;
  guardarRangoLectivo: (r: RangoLectivo) => Promise<{ ok: boolean } | void>;
}

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
