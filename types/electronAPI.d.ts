import type { Curso } from "@/models/curso"
import type { Asignatura } from "@/models/asignatura"
import type { Alumno, AlumnoEntrada } from "@/models/alumno"
import type { Horario } from "@/models/horario"

export interface ElectronAPI {
  // Cursos
  leerCursos: () => Promise<Curso[]>
  guardarCurso: (curso: Curso) => Promise<void>
  borrarCurso: (id: string) => Promise<void>

  // Asignaturas
  leerAsignaturas: () => Promise<Asignatura[]>
  leerAsignatura: (id: string) => Promise<any>
  guardarAsignatura: (asignatura: Asignatura) => Promise<void>
  actualizarColorAsignatura: (id: string, color: string) => Promise<void>
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) => Promise<void>
  asignaturasDeCurso: (cursoId: string) => Promise<{ id: string; nombre: string }[]>


  // Alumnos
  leerAlumnos: () => Promise<Alumno[]>
  leerAlumnosPorCurso: (cursoId: string) => Promise<Alumno[]>
  guardarAlumno: (alumno: AlumnoEntrada) => Promise<void>

  // Horarios
  leerHorarios: (asignaturaId: string) => Promise<Horario[]>
  leerHorariosTodos: () => Promise<Horario[]>
  guardarHorario: (horario: {
    asignaturaId: string
    dia: string
    horaInicio: string
    horaFin: string
  }) => Promise<void>
  borrarHorario: (datos: {
    asignaturaId: string
    dia: string
    horaInicio: string
  }) => Promise<void>

  // Otros
  leerNombres?: () => Promise<string[]>
  guardarNombre?: (nombre: string) => Promise<void>

  guardarActividad: (actividad: Actividad) => Promise<{ success: boolean }>
  actividadesDeCurso: (cursoId: string) => Promise<Actividad[]>;

  obtenerRAPorAsignatura: (asignaturaId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;
  obtenerCEPorRA: (raId: string) => Promise<
    { id: string; codigo: string; descripcion: string }[]
  >;
  analizarDescripcion: (actividadId: string) => Promise<CEDetectado[]>;
// extraemos texto desde un PDF
  extraerTextoPDF: (rutaPDF: string) => Promise<string | null>;

  analizarDescripcionDesdeTexto: (texto: string, asignaturaId: string) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
