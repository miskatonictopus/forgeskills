// types/electronAPI.d.ts

import type { Curso } from "@/models/curso"
import type { Asignatura } from "@/models/asignatura"
import type { Alumno } from "@/models/alumno"
import type { Horario } from "@/models/horario"

export interface ElectronAPI {
  // Cursos
  leerCursos: () => Promise<Curso[]>
  guardarCurso: (curso: Curso) => Promise<void>

  // Asignaturas
  leerAsignaturas: () => Promise<Asignatura[]>
  guardarAsignatura: (asignatura: Asignatura) => Promise<void>

  // Alumnos
  leerAlumnos: () => Promise<Alumno[]>
  guardarAlumno: (alumno: Alumno) => Promise<void>

  // Horarios
  leerHorarios: (asignaturaId: string) => Promise<Horario[]>
  guardarHorario: (horario: {
    asignaturaId: string
    dia: string
    horaInicio: string
    horaFin: string
  }) => Promise<void>

  // Otros (si los tienes)
  leerHorariosTodos?: () => Promise<any[]>
}


declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}