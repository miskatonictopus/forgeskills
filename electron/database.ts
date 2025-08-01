import Database from "better-sqlite3"
import * as path from "path"

const dbPath = path.join(process.cwd(), "data", "db.sqlite")
export const db = new Database(dbPath)


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

  db.prepare(`
    CREATE TABLE IF NOT EXISTS asignaturas (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      creditos TEXT,
      descripcion TEXT, 
      RA TEXT           
    )
  `).run()

  db.prepare(`
  CREATE TABLE IF NOT EXISTS actividades (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    fecha TEXT NOT NULL,
    curso_id TEXT NOT NULL,
    asignatura_id TEXT NOT NULL,
    FOREIGN KEY (curso_id) REFERENCES cursos(id),
    FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
  )
`).run();
}
