import type { Curso } from "@/models/curso";
import type { Asignatura } from "@/models/asignatura";
import type { Alumno, AlumnoEntrada } from "@/models/alumno";
import type { Horario } from "@/models/horario";
import type { Actividad } from "@/store/actividadesPorCurso";

// 🆕 Tipos calendario
export type RangoLectivo = { start: string; end: string };              // "YYYY-MM-DD"
export type Festivo = {
  id: string;
  start: string;           
  end?: string | null;     
  title: string;          
};

export type GuardarActividadPayload = {
  id: string;
  nombre: string;
  fecha: string;        // "YYYY-MM-DD"
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
  diaSemana: number;   // 1..5 (L..V) (ajusta si usas 0..6)
  horaInicio: string;  // "HH:MM"
  horaFin: string;     // "HH:MM"
};

export type Festivo = { id: string; start: string; end: string | null; title: string };
export type FestivoCreate = { start: string; end?: string | null; title: string };

export interface ElectronAPI {
  // Cursos
  leerCursos: () => Promise<Curso[]>;
  guardarCurso: (curso: Curso) => Promise<void>;
  borrarCurso: (id: string) => Promise<void>;

  // Asignaturas
  leerAsignaturas: () => Promise<Asignatura[]>;
  leerAsignatura: (id: string) => Promise<any>;
  guardarAsignatura: (asignatura: any) => Promise<void>;
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
  guardarActividad(payload: GuardarActividadPayload): Promise<GuardarActividadResult>;
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
  // Lectivo
  leerRangoLectivo: () => Promise<RangoLectivo | null>;
  guardarRangoLectivo: (r: RangoLectivo) => Promise<{ ok: boolean } | void>;

  // Festivos
  listarFestivos: () => Promise<Festivo[]>;
  crearFestivo: (f: { start: string; end?: string | null; title: string }) => Promise<Festivo>;
  borrarFestivo: (id: string) => Promise<{ ok: boolean }>;

 // Lectivo
 leerRangoLectivo: () => Promise<{ start?: string; end?: string }>;
 guardarRangoLectivo: (r: { start: string; end: string }) => Promise<void>;

 // Festivos
 listarFestivos: () => Promise<Festivo[]>;
 crearFestivo: (f: FestivoCreate) => Promise<Festivo>;
 borrarFestivo: (id: string) => Promise<{ ok: boolean }>;

 // Presencialidades
 listarPresencialidades: () => Promise<Presencialidad[]>;
 crearPresencialidad: (p: { diaSemana: number; horaInicio: string; horaFin: string }) => Promise<Presencialidad>;
 borrarPresencialidad: (id: string) => Promise<{ ok: boolean }>;

 listarFCT: () => Promise<FCTTramo[]>;
      crearFCT: (p: { diaSemana: number; horaInicio: string; horaFin: string }) => Promise<FCTTramo>;
      borrarFCT: (id: string) => Promise<{ ok: boolean }>;

      horariosDeAsignatura: (params: { cursoId: string; asignaturaId: string }) =>
      Promise<Array<{ diaSemana: number; horaInicio: string; horaFin: string }>>;

      exportarPDFDesdeHTML: (
        html: string,
        fileName: string
      ) => Promise<{ ok: boolean; path?: string; error?: string }>;

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
