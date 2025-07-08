import { app } from "electron"
import Database from "better-sqlite3"
import * as path from "path"
import * as fs from "fs"

const dbPath = path.join(app.getPath("userData"), "database.db")

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, "")
}

export const db = new Database(dbPath)

