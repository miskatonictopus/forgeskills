export {}

declare global {
  interface Window {
    electronAPI: {
      // ✅ Nombres
      guardarNombre: (nombre: string) => Promise<void>
      leerNombres: () => Promise<string[]>

      // ✅ Asignaturas
      leerAsignaturas: () => Promise<any[]>
      guardarAsignatura: (asignatura: {
        id: string
        nombre: string
        creditos: string
        descripcion: {
          duracion: string
          centro: string
          empresa: string
        }
        RA: {
          codigo: string
          descripcion: string
          CE: { codigo: string; descripcion: string }[]
        }[]
      }) => Promise<void>

      // ✅ Cursos
      guardarCurso: (curso: {
        acronimo: string
        nombre: string
        nivel: string
        grado: string
        clase: string
      }) => Promise<void>
      leerCursos: () => Promise<any[]>
      borrarCurso: (id: string) => Promise<void>

      // ✅ Alumnos
      guardarAlumno: (alumno: { nombre: string; curso: string }) => Promise<void>
      leerAlumnos: () => Promise<any[]>

      // ✅ Horarios
      guardarHorario: (horario: {
        asignaturaId: string
        dia: string
        horaInicio: string
        horaFin: string
      }) => Promise<void>

      leerHorarios: (asignaturaId: string) => Promise<Horario[]>
    }
  }

  type Horario = {
    dia: string
    horaInicio: string
    horaFin: string
  }
}
