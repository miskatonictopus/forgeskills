export {}

declare global {
  interface Window {
    electronAPI: {
      guardarNombre: (nombre: string) => Promise<void>
      leerNombres: () => Promise<any[]>

      guardarCurso: (curso: {
        acronimo: string
        nombre: string
        nivel: string
        grado: string
        clase: string
      }) => Promise<{ success: boolean; id: string }>

      leerCursos: () => Promise<any[]>
      borrarCurso: (id: string) => Promise<{ success: boolean }>
    }
  }
}
