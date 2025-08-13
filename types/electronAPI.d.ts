import type { Curso } from "@/models/curso";
import type { Asignatura } from "@/models/asignatura";
import type { Alumno, AlumnoEntrada } from "@/models/alumno";
import type { Horario } from "@/models/horario";
import type { Actividad } from "@/store/actividadesPorCurso"; // 👈 faltaba
import { ipcMain } from "electron";


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
    id: number|string;
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

  // Actividades
  guardarActividad: (actividad: Actividad) => Promise<{ success: boolean }>;
  actividadesDeCurso: (cursoId: string) => Promise<Actividad[]>;

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

  // Persistencia del análisis
  guardarAnalisisActividad: (
    actividadId: string,
    umbral: number,
    ces: { codigo: string; puntuacion: number; reason?: "evidence" | "high_sim" | "lang_rule"; evidencias?: string[] }[]
  ) => Promise<{ ok: boolean }>;
  leerAnalisisActividad: (
    actividadId: string
  ) => Promise<{ umbral: number; fecha: string | null; ces: CEDetectado[] }>;
  
  borrarActividad: (actividadId: string) => Promise<void>;

  getHorariosAsignatura(cursoId: string, asignaturaId: string): Promise<
  { diaSemana: number; horaInicio: string; horaFin: string }[]
>;

listarActividadesGlobal: () => Promise<Array<{
  id: string;
  nombre: string;
  fecha: string;                 // "YYYY-MM-DD"
  descripcion?: string | null;
  cursoId?: string | null;
  cursoNombre?: string | null;
  asignaturaId?: string | null;
  asignaturaNombre?: string | null;
  horaInicio?: string | null;    // "HH:mm"
  horaFin?: string | null;       // "HH:mm"
}>>;

actualizarActividadFecha: (id: string, fecha: string) => Promise<{ ok: boolean }>;
  
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
    electronAPI: ElectronAPI; // 👈 una única firma completa
  }
}

export {};
