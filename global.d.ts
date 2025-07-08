export {}

declare global {
  interface Window {
    electronAPI: {
      guardarNombre: (nombre: string) => Promise<void>
      leerNombres: () => Promise<{ id: number; nombre: string }[]>
    }
  }
}