import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "path"
import { db, initDB } from "./database"

initDB()

const isDev = !app.isPackaged

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    win.loadURL("http://localhost:3000")
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, "../.next/renderer/index.html"))
  }
}

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// ---------------------------
// IPC handlers para CURSOS
// ---------------------------

ipcMain.handle("leer-cursos", () => {
  return db.prepare("SELECT * FROM cursos").all()
})

ipcMain.handle("guardar-curso", (_event, curso) => {
  console.log("📥 Curso recibido en main:", curso)
  const { acronimo, nombre, nivel, grado, clase } = curso

  if (!acronimo || !nivel || !clase) {
    throw new Error("Faltan campos obligatorios: acrónimo, nivel o clase.")
  }

  const id = `${acronimo}${nivel}${clase}`.toUpperCase()

  db.prepare(`
    INSERT OR REPLACE INTO cursos (id, acronimo, nombre, nivel, grado, clase)
    VALUES (@id, @acronimo, @nombre, @nivel, @grado, @clase)
  `).run({
    id,
    acronimo,
    nombre,
    nivel,
    grado,
    clase,
  })

  return { success: true, id }
})

ipcMain.handle("borrar-curso", (_event, id) => {
  db.prepare("DELETE FROM cursos WHERE id = ?").run(id)
  return { success: true }
})

// ---------------------------
// IPC handlers para NOMBRES
// ---------------------------

ipcMain.handle("leer-nombres", () => {
  return db.prepare("SELECT * FROM nombres").all()
})

ipcMain.handle("guardar-nombre", (_event, nombre: string) => {
  db.prepare("INSERT INTO nombres (nombre) VALUES (?)").run(nombre)
})

ipcMain.handle("guardar-asignatura", async (_event, asignatura) => {
  try {
    // Aquí puedes guardar la asignatura en JSON o SQLite según tu lógica actual
    // Ejemplo si estás usando JSON por ahora:
    const fs = require("fs")
    const path = require("path")
    const filePath = path.join(__dirname, "asignaturas", `${asignatura.id}_${asignatura.nombre}.json`)

    fs.writeFileSync(filePath, JSON.stringify(asignatura, null, 2), "utf-8")
    return true
  } catch (error) {
    console.error("Error al guardar asignatura:", error)
    throw error
  }
})

ipcMain.handle("guardar-alumno", async (_event, alumno) => {
  try {
    const fs = require("fs")
    const path = require("path")
    const basePath = path.join(__dirname, "alumnos")
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath)

    const filename = `${alumno.nombre}_${alumno.curso}.json`
    const filePath = path.join(basePath, filename)

    fs.writeFileSync(filePath, JSON.stringify(alumno, null, 2), "utf-8")
    return true
  } catch (error) {
    console.error("❌ Error al guardar alumno:", error)
    throw error
  }
})

