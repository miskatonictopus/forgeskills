import { contextBridge, ipcRenderer } from "electron"
import type { Curso } from "../types/curso"

contextBridge.exposeInMainWorld("electronAPI", {
  leerCursos: () => ipcRenderer.invoke("leer-cursos"),
  guardarCurso: (curso: Curso) => ipcRenderer.invoke("guardar-curso", curso),
  borrarCurso: (id: string) => ipcRenderer.invoke("borrar-curso", id),
})
