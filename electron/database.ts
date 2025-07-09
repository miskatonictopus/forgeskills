import Database from "better-sqlite3"
import * as path from "path"

export const db = new Database(path.join(__dirname, "../data/db.sqlite"))

export const initDB = () => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS cursos (
      id TEXT PRIMARY KEY,
      acronimo TEXT,
      nombre TEXT,
      nivel TEXT,
      grado TEXT,
      clase TEXT
    )
  `).run()

  db.prepare(`
    CREATE TABLE IF NOT EXISTS nombres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT
    )
  `).run()
}
