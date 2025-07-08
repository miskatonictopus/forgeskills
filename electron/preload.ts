// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  guardarNombre: (nombre: string) => ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),
})