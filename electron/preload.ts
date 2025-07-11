import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  // Nombres (para pruebas)
  guardarNombre: (nombre: string) => ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),

  // Cursos (con clase e ID compuesto)
  guardarCurso: (curso: {
    acronimo: string
    nombre: string
    nivel: string
    grado: string
    clase: string
  }) => ipcRenderer.invoke("guardar-curso", curso),
  leerCursos: () => ipcRenderer.invoke("leer-cursos"),
  borrarCurso: (id: string) => ipcRenderer.invoke("borrar-curso", id),
  guardarAsignatura: (asignatura: { id: string; nombre: string }) =>
  ipcRenderer.invoke("guardar-asignatura", asignatura),
  guardarAlumno: (alumno: { nombre: string; curso: string }) =>
  ipcRenderer.invoke("guardar-alumno", alumno),

})
