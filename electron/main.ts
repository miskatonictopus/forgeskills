import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "path"
import { db } from "./database"

const isDev = !app.isPackaged

// Aseguramos que la tabla nombres existe al arrancar la app
db.prepare(`
  CREATE TABLE IF NOT EXISTS nombres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT
  )
`).run()

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.js"),
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

// IPC handlers para cursos
ipcMain.handle("leer-cursos", () => {
  return db.prepare("SELECT * FROM cursos").all()
})

ipcMain.handle("guardar-curso", (_event, curso) => {
  db.prepare(`
    INSERT OR REPLACE INTO cursos (id, acronimo, nombre, nivel, grado)
    VALUES (@id, @acronimo, @nombre, @nivel, @grado)
  `).run(curso)
})

ipcMain.handle("borrar-curso", (_event, id) => {
  db.prepare("DELETE FROM cursos WHERE id = ?").run(id)
})

// IPC handlers para nombres
ipcMain.handle("leer-nombres", () => {
  return db.prepare("SELECT * FROM nombres").all()
})

ipcMain.handle("guardar-nombre", (_event, nombre: string) => {
  db.prepare("INSERT INTO nombres (nombre) VALUES (?)").run(nombre)
})
