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

type ActividadProgramarPayload = {
  actividadId: string;
  startISO: string;      // "YYYY-MM-DD HH:mm"
  duracionMin: number;   // múltiplos de 60 (según tu main)
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

type HorarioNormalizado = {
  diaSemana: number;       // 0..6 (getDay)
  horaInicio: string;      // "HH:MM"
  horaFin: string;         // "HH:MM"
};

type LectivoRange = { start?: string; end?: string } | null;

export type Festivo = { id: string; start: string; end: string | null; title: string };
export type FestivoCreate = { start: string; end?: string | null; title: string };

export interface ElectronAPI {
  // Cursos
  leerCursos: () => Promise<Curso[]>;
  guardarCurso: (curso: Curso) => Promise<void>;
  borrarCurso: (id: string) => Promise<void>;
  forzarRevisionEstados: () => Promise<number>;
  // Asignaturas
  leerAsignaturas: () => Promise<Asignatura[]>;
  leerAsignatura: (id: string) => Promise<any>;
  guardarAsignatura: (asignatura: any) => Promise<void>;
  actualizarColorAsignatura: (id: string, color: string) => Promise<void>;
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) => Promise<void>;
  asignaturasDeCurso: (cursoId: string) => Promise<{ id: string; nombre: string }[]>;
  onActividadesActualizadas: (
    callback: (payload: { count: number }) => void
  ) => () => void;
  // Alumnos
  leerAlumnos: () => Promise<Alumno[]>;
  leerAlumnosPorCurso: (cursoId: string) => Promise<Alumno[]>;
  guardarAlumno: (alumno: AlumnoEntrada) => Promise<void>;
  obtenerAlumnosPorCurso: (cursoId: string) => Promise<
  { id: string; nombre: string; apellidos: string }[]
>;
alumnosPorCurso: (
  cursoId: string
) => Promise<{ id: string; nombre: string; apellidos: string }[]>;
evaluarActividad: (
  actividadId: string,
  notas: { alumnoId: string; nota: number }[]
) => Promise<{ ok: boolean }>;
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
     
      leerAsignaturasCurso: (cursoId: string) => Promise<{ id: string; nombre: string; color?: string | null }[]>

      leerAnalisisActividad(actividadId: string): Promise<AnalisisActividadSnapshot>;
  actividadProgramar(payload: ActividadProgramarPayload): Promise<ActividadProgramarResult>;

  horariosDeAsignatura(cursoId: string, asignaturaId: string): Promise<HorarioNormalizado[]>;
  leerRangoLectivo(): Promise<LectivoRange>;

  evaluarYPropagarActividad: (actividadId: string) => Promise<{ ok: boolean }>;

  guardarNotasActividad(actividadId: string, notas: { alumnoId: string; nota: number }[]): Promise<{ ok: true }>;

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
  ) => Promise<
    Array<{ ceCodigo: string; descripcion: string; raCodigo: string }>
  >;

  obtenerMediasAlumnosCurso: (
    cursoId: string
  ) => Promise<{
    asignaturas: { id: string; nombre: string; color: string }[];
    alumnos: { id: string; nombre: string; apellidos: string; mail?: string | null }[];
    mediaMap: Record<string, Record<string, number>>;
  }>;
  
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
