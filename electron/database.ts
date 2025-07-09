import Database from "better-sqlite3"
import * as path from "path"
import * as fs from "fs"

// 📁 Directorio de datos
const dataDir = path.join(__dirname, "..", "data")
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// 📦 Ruta al archivo SQLite
const dbPath = path.join(dataDir, "database.sqlite")
export const db = new Database(dbPath)

// 🧱 Tabla nombres (por si la usas en pruebas)
db.prepare(`
  CREATE TABLE IF NOT EXISTS nombres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL
  )
`).run()

// 🧱 Tabla cursos con campo CLASE y ID compuesto (acronimo+nivel+clase)
db.prepare(`
  CREATE TABLE IF NOT EXISTS cursos (
    id TEXT PRIMARY KEY,
    acronimo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    nivel TEXT NOT NULL,
    grado TEXT NOT NULL,
    clase TEXT NOT NULL
  )
`).run()
