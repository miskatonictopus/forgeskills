import { app, BrowserWindow, ipcMain } from "electron"
import * as path from "path"
import { db } from "./database"

const isDev = !app.isPackaged

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.js"), // CUIDADO aquí
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
