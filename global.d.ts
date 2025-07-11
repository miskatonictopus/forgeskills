export {}

declare global {
  interface Window {
    electronAPI: {
      guardarNombre: (nombre: string) => Promise<void>
      leerNombres: () => Promise<string[]>

      guardarCurso: (curso: {
        acronimo: string
        nombre: string
        nivel: string
        grado: string
        clase: string
      }) => Promise<void>

      leerCursos: () => Promise<any[]>
      borrarCurso: (id: string) => Promise<void>

      guardarAsignatura: (asignatura: {
        id: string
        nombre: string
      }) => Promise<void>

      guardarAlumno: (alumno: { nombre: string; curso: string }) => Promise<void>
    }
  }
}
