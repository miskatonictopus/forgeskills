import type { Alumno, AlumnoEntrada } from "@/models/alumno"
import type { Asignatura } from "@/models/asignatura"

export {}

declare global {
  interface Window {
    electronAPI: {
      // Alumnos
      guardarAlumno: (alumno: AlumnoEntrada) => Promise<void>
      leerAlumnos: () => Promise<Alumno[]>
      leerAlumnosPorCurso: (cursoId: string) => Promise<Alumno[]>

      // Asignaturas
      guardarAsignatura: (asignatura: Asignatura) => Promise<void>
      leerAsignaturas: () => Promise<Asignatura[]>
      actualizarColorAsignatura: (id: string, color: string) => Promise<void>

      // Cursos
      guardarCurso: (curso: {
        acronimo: string
        nombre: string
        nivel: string
        grado: string
        clase: string
      }) => Promise<void>
      leerCursos: () => Promise<any[]>
      borrarCurso: (id: string) => Promise<void>

      // Nombres (pruebas)
      guardarNombre: (nombre: string) => Promise<void>
      leerNombres: () => Promise<string[]>

      // Horarios
      guardarHorario: (horario: {
        asignaturaId: string
        dia: string
        horaInicio: string
        horaFin: string
      }) => Promise<void>
      leerHorarios: (asignaturaId: string) => Promise<Horario[]>
      leerHorariosTodos: () => Promise<Horario[]>
      borrarHorario: (datos: {
        asignaturaId: string
        dia: string
        horaInicio: string
      }) => Promise<void>
    }
  }

  type Horario = {
    asignaturaId?: string
    dia: string
    horaInicio: string
    horaFin: string
  }
}
