// src/main/db/singleton.ts
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function openDbSingleton(dbPath: string) {
  if (!db) {
    db = new Database(dbPath);
    // Opcional: pragmas base
    db.pragma("journal_mode = wal");
    db.pragma("synchronous = normal");
  }
  return db;
}

export function getDb() {
  if (!db) throw new Error("DB no abierta. Llama a openDbSingleton primero.");
  return db;
}

export function closeDbSingleton() {
  if (db) { db.close(); db = null; }
}