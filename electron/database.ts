// electron/database.ts
import Database from "better-sqlite3"
import { app } from "electron"
import * as path from "path"

const dbPath = path.join(app.getPath("userData"), "database.db")
export const db = new Database(dbPath)

// Crear tabla si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS nombres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
  )
`).run()
