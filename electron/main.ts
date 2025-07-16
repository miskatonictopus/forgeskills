import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "path"
import { db, initDB } from "./database"
import type { Asignatura } from "../models/asignatura"

initDB()

// Tabla ALUMNOS

db.prepare(`
  CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidos TEXT,
    curso TEXT,
    mail TEXT
  )
`).run()

// Tabla HORARIOS

db.prepare(`
  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignatura_id TEXT NOT NULL,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL
  )
`).run()

const isDev = !app.isPackaged

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1400, 
    minHeight: 800,
    resizable: true,
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
  console.log("📅 Curso recibido en main:", curso)
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

// ---------------------------
// IPC handler para ASIGNATURAS
// ---------------------------

ipcMain.handle("guardar-asignatura", async (_event, asignatura) => {
  try {
    const { id, nombre, creditos, descripcion, RA } = asignatura

    if (!id || !nombre || !creditos || !descripcion || !RA) {
      throw new Error("Faltan campos en la asignatura.")
    }

    db.prepare(`
      INSERT OR REPLACE INTO asignaturas (id, nombre, descripcion, RA)
      VALUES (@id, @nombre, @descripcion, @RA)
    `).run({
      id,
      nombre,
      creditos,
      descripcion: JSON.stringify(descripcion),
      RA: JSON.stringify(RA),
    })

    return { success: true }
  } catch (error) {
    console.error("❌ Error al guardar asignatura:", error)
    throw error
  }
})

ipcMain.handle("leer-asignaturas", () => {
  const rows = db.prepare("SELECT * FROM asignaturas").all() as {
    id: string
    nombre: string
    creditos: string
    descripcion: string
    RA: string
  }[]

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    creditos: row.creditos,
    descripcion: JSON.parse(row.descripcion),
    RA: JSON.parse(row.RA),
  })) satisfies Asignatura[]
})

// ---------------------------
// IPC handler para ALUMNOS
// ---------------------------

ipcMain.handle("guardar-alumno", async (_event, alumno) => {
  console.log("📩 Guardando alumno en SQLite:", alumno)
  try {
    const stmt = db.prepare(`
      INSERT INTO alumnos (nombre, apellidos, curso, mail)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(
      alumno.nombre,
      alumno.apellidos,
      alumno.curso,
      alumno.mail
    )

    return { success: true }
  } catch (error) {
    console.error("❌ Error al guardar alumno en SQLite:", error)
    throw error
  }
})

ipcMain.handle("leer-alumnos", () => {
  return db.prepare("SELECT * FROM alumnos").all()
})

// ---------------------------
// IPC handler para HORARIOS
// ---------------------------


ipcMain.handle("guardar-horario", (event, horario) => {
  const stmt = db.prepare(`
    INSERT INTO horarios (asignatura_id, dia, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(horario.asignaturaId, horario.dia, horario.horaInicio, horario.horaFin)

  return { success: true }
})

ipcMain.handle("leer-horarios", (event, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT dia, hora_inicio, hora_fin
    FROM horarios
    WHERE asignatura_id = ?
  `)

  const resultados = stmt.all(asignaturaId) as {
    dia: string
    hora_inicio: string
    hora_fin: string
  }[]

  return resultados.map((h) => ({
    dia: h.dia,
    horaInicio: h.hora_inicio,
    horaFin: h.hora_fin,
  }))
})

