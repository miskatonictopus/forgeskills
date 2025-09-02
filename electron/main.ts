/* ============================================================================
 * IMPORTS (únicos)
 * ==========================================================================*/
import { openDbSingleton, closeDbSingleton, getDb } from "../src/main/db/singleton";
import { BackupManager } from "../main/backup";

import * as dotenv from "dotenv";
dotenv.config();
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { generarPDFInformeActividad } from "../lib/pdf/actividadInforme"; // ajusta la ruta si cambia

import { execSync } from "child_process";
import { writeFile } from "node:fs/promises";
import * as crypto from "crypto";
import { inicializarCron } from "./cron";
import { v4 as uuid, v4 as uuidv4 } from "uuid"; // si solo usas uno, deja uno
import { initDB } from "./database";
import type { Asignatura } from "../models/asignatura";
import { analizarDescripcionActividad } from "../src/lib/analizarDescripcionActividad";
import { analizarTextoPlano } from "../src/lib/analizarTextoPlano";
import { extraerTextoConMutool } from "../src/lib/extraerTextoMutool";

/* (opcional) si usas randomUUID explícito */
const { randomUUID } = crypto;

/* ============================================================================
 * LOG INICIAL
 * ==========================================================================*/
console.log("🔑 API KEY:", process.env.OPENAI_API_KEY);

/* ============================================================================
 * Inicializar base de datos (robusto dev/prod)
 * ==========================================================================*/
function resolveDbPath() {
  // En dev: repo/data/db.sqlite ; En prod: resources/data/db.sqlite
  const devPath = path.join(process.cwd(), "data", "db.sqlite");
  const prodPath = path.join(process.resourcesPath, "data", "db.sqlite");
  return app.isPackaged ? prodPath : devPath;
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true }); // asegúrate de que existe /data
console.log("📂 DB path:", dbPath, "| exists:", fs.existsSync(dbPath));

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
(globalThis as any).db = db;

// tu init como lo tenías (usa el db global)
initDB();

// sanity log de tablas al arrancar
try {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1`)
    .all()
    .map((t: any) => t.name);
  console.log("🧾 Tablas detectadas:", tables);
} catch (e) {
  console.error("❌ Error listando tablas:", e);
}

const DB_PATH =
  app.isPackaged
    ? path.join(app.getPath("userData"), "forgeskills.sqlite") // PROD
    : path.join(process.cwd(), "data", "forgeskills.sqlite");  // DEV

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Abre la DB (singleton) al arrancar
app.whenReady().then(() => {
  openDbSingleton(DB_PATH);
  (globalThis as any).db = getDb(); // si tu initDB lo usa
  initDB();
});

// Si haces restore en caliente:
ipcMain.handle("backup:restore", async (_e, filePath: string) => {
  try {
    closeDbSingleton();                // 1) cerrar
    await backups.restore(filePath);   // 2) copiar/replace
    openDbSingleton(DB_PATH);          // 3) reabrir
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/* ============================================================================
 * IPC de diagnóstico (opcional, útil para depurar rutas/tablas desde el front)
 * ==========================================================================*/
ipcMain.handle("debug.dbinfo", () => {
  const info = {
    dbPath,
    exists: fs.existsSync(dbPath),
    tables: [] as string[],
  };
  try {
    info.tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1`)
      .all()
      .map((t: any) => t.name);
  } catch {}
  return info;
});
/* ------------------------------- Migraciones -------------------------------- */
// aquí pondrías cualquier migración extra que quieras aplicar

function colExists(table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some((r) => r.name === col);
}

function tableExists(table: string) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  return !!row;
}

function ensureSchema() {
  // columnas nuevas en 'actividades'
  if (!colExists("actividades", "estado")) {
    db.prepare(
      `ALTER TABLE actividades ADD COLUMN estado TEXT NOT NULL DEFAULT 'borrador'`
    ).run();
  }
  if (!colExists("actividades", "umbral_aplicado")) {
    db.prepare(
      `ALTER TABLE actividades ADD COLUMN umbral_aplicado INTEGER`
    ).run();
  }
  if (!colExists("actividades", "analisis_fecha")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN analisis_fecha TEXT`).run();
  }
  if (!colExists("actividades", "programada_para")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN programada_para TEXT`).run(); // "YYYY-MM-DD HH:MM"
  }
  if (!colExists("actividades", "programada_fin")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN programada_fin TEXT`).run(); // "YYYY-MM-DD HH:MM"
  }

  // tablas snapshot y auditoría
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS actividad_ce (
      actividad_id TEXT NOT NULL,
      ce_codigo TEXT NOT NULL,
      puntuacion REAL NOT NULL,
      razon TEXT,
      evidencias TEXT,
      incluido INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (actividad_id, ce_codigo)
    )
  `
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS actividad_estado_historial (
      id TEXT PRIMARY KEY,
      actividad_id TEXT NOT NULL,
      estado TEXT NOT NULL,              -- 'borrador' | 'analizada' | 'programada' | ...
      fecha TEXT NOT NULL,               -- ISO datetime
      meta TEXT
    )
  `
  ).run();

  // festivos (por si no existiera aún)
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS festivos (
      id TEXT PRIMARY KEY,
      start TEXT NOT NULL,               -- "YYYY-MM-DD"
      end   TEXT,                        -- opcional ("YYYY-MM-DD")
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `
  ).run();
  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_festivos_start ON festivos (start)`
  ).run();
  db.prepare(
    `
    CREATE UNIQUE INDEX IF NOT EXISTS unq_festivos_start_end_title
    ON festivos (start, COALESCE(end, start), title)
  `
  ).run();

  // horarios: asegurar curso_id y crear índices
  if (tableExists("horarios") && !colExists("horarios", "curso_id")) {
    db.prepare(`ALTER TABLE horarios ADD COLUMN curso_id TEXT`).run();
  }

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_horarios_curso_asig_dia
    ON horarios(curso_id, asignatura_id, dia, hora_inicio, hora_fin)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_actividades_prog
    ON actividades(curso_id, programada_para, programada_fin)
  `
  ).run();
}

ensureSchema();

function hoyYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

function lectivoGet(): { start?: string; end?: string } {
  const row = db
    .prepare(`SELECT start, end FROM rango_lectivo WHERE id = 1`)
    .get() as { start?: string; end?: string } | undefined;
  return row || {};
}

/** true si ymd está dentro del lectivo (si existe) */
function lectivoContains(ymd: string): boolean {
  const { start, end } = lectivoGet();
  if (!start || !end) return true; // si no hay rango guardado, no bloqueamos desde backend
  return ymd >= start && ymd <= end;
}

/* ---------------------------- Tablas básicas ---------------------------- */

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidos TEXT,
    curso TEXT,
    mail TEXT
  )
`
).run();

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id TEXT,                -- puede ser NULL si vino de DB antigua; ensureSchema ya lo añade
    asignatura_id TEXT NOT NULL,
    dia TEXT NOT NULL,            -- 'lunes' ... 'viernes'
    hora_inicio TEXT NOT NULL,    -- 'HH:MM'
    hora_fin TEXT NOT NULL        -- 'HH:MM'
  )
`
).run();

/* ============================================================================
 * HORAS LECTIVAS (nuevo): helpers + handler calcular-horas-reales
 * ==========================================================================*/
type CalcularHorasOpts = {
  cursoId?: string;
  asignaturaId?: string;
  incluirFechas?: boolean;
  desde?: string; // opcional: si lo pasas, ignora rango_lectivo
  hasta?: string; // opcional
};
type CalcularHorasItem = {
  cursoId: string | null;
  asignaturaId: string;
  asignaturaNombre: string;
  sesiones: number;
  minutos: number;
  horas: number;
  fechas?: string[];
};
type CalcularHorasRes = {
  desde: string;
  hasta: string;
  festivos: Array<{ inicio: string; fin: string; descripcion?: string }>;
  items: CalcularHorasItem[];
  totalHoras: number;
};

function HR_toDate(ymd: string): Date {
  const [y, m, d] = (ymd || "").split("-").map((n) => parseInt(n, 10));
  const dt = new Date((y || 1970), (m || 1) - 1, (d || 1));
  if (Number.isNaN(dt.getTime())) throw new Error(`Fecha inválida: ${ymd}`);
  return dt;
}
function HR_formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function HR_addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}
function HR_weekdayISO(d: Date): number {
  const w = d.getDay(); // 0=dom..6=sab
  return w === 0 ? 7 : w;
}
function HR_firstDateForWeekday(start: Date, weekdayIso: number): Date {
  let cur = new Date(start);
  while (HR_weekdayISO(cur) !== weekdayIso) cur = HR_addDays(cur, 1);
  return cur;
}
function HR_timeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "").split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}
function HR_diaToIso(dia: string | number): number {
  if (typeof dia === "number" && dia >= 1 && dia <= 7) return dia;
  const s = String(dia ?? "").trim().toLowerCase();
  const map: Record<string, number> = {
    "1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,
    lunes:1,monday:1,mon:1,
    martes:2,tuesday:2,tue:2,
    miércoles:3,miercoles:3,wednesday:3,wed:3,
    jueves:4,thursday:4,thu:4,
    viernes:5,friday:5,fri:5,
    sábado:6,sabado:6,saturday:6,sat:6,
    domingo:7,sunday:7,sun:7,
  };
  return map[s] ?? 1;
}

function calcularHorasLectivas(dbx: BetterSqlite3.Database, opts: CalcularHorasOpts = {}): CalcularHorasRes {
  // 1) Rango: opts.desde/hasta o tabla rango_lectivo (id=1 con columnas start/end)
  let desdeStr = opts.desde;
  let hastaStr = opts.hasta;

  if (!desdeStr || !hastaStr) {
    const rango = dbx
      .prepare(`SELECT start, end FROM rango_lectivo WHERE id = 1`)
      .get() as { start?: string; end?: string } | undefined;
    if (!rango?.start || !rango?.end) {
      throw new Error("No hay rango lectivo definido (tabla rango_lectivo, fila id=1). O pasa {desde,hasta}.");
    }
    desdeStr = desdeStr || rango.start;
    hastaStr = hastaStr || rango.end;
  }

  const desde = HR_toDate(desdeStr!);
  const hasta = HR_toDate(hastaStr!);
  if (hasta < desde) throw new Error("Rango inválido: hasta < desde");

  // 2) Festivos que solapan el rango (usando tu esquema start/end/title)
  const festivos = dbx
    .prepare(
      `SELECT start AS inicio, COALESCE(end,start) AS fin, title AS descripcion
       FROM festivos
       WHERE date(COALESCE(end,start)) >= date(?)
         AND date(start) <= date(?)`
    )
    .all(HR_formatYMD(desde), HR_formatYMD(hasta)) as Array<{ inicio: string; fin: string; descripcion?: string }>;

  const festivoRangos = festivos.map((f) => ({ ini: HR_toDate(f.inicio), fin: HR_toDate(f.fin) }));
  const esFestivo = (d: Date) => festivoRangos.some((r) => d >= r.ini && d <= r.fin);

  // 3) Horarios (filtrando opcionalmente por curso/asignatura) + nombre de asignatura
  const horarios = dbx
    .prepare(
      `SELECT
         h.id,
         h.dia,
         h.hora_inicio   AS horaInicio,
         h.hora_fin      AS horaFin,
         h.curso_id      AS cursoId,
         h.asignatura_id AS asignaturaId,
         a.nombre        AS asignaturaNombre
       FROM horarios h
       JOIN asignaturas a ON a.id = h.asignatura_id
       WHERE (? IS NULL OR h.curso_id = ?)
         AND (? IS NULL OR h.asignatura_id = ?)`
    )
    .all(
      opts.cursoId ?? null, opts.cursoId ?? null,
      opts.asignaturaId ?? null, opts.asignaturaId ?? null
    ) as Array<{
      id: string | number;
      dia: string;
      horaInicio: string;
      horaFin: string;
      cursoId: string | null;
      asignaturaId: string;
      asignaturaNombre: string;
    }>;

  type Acum = {
    asignaturaId: string;
    asignaturaNombre: string;
    cursoId: string | null;
    sesiones: number;
    minutos: number;
    fechas?: string[];
  };
  const acum = new Map<string, Acum>();

  // 4) Expandir semanas dentro del rango, excluyendo festivos
  for (const h of horarios) {
    const weekday = HR_diaToIso(h.dia);
    const inicioMin = HR_timeToMinutes(h.horaInicio);
    const finMin = HR_timeToMinutes(h.horaFin);
    const duracionMin = Math.max(0, finMin - inicioMin);
    if (duracionMin <= 0) continue;

    let d = HR_firstDateForWeekday(desde, weekday);
    while (d <= hasta) {
      if (!esFestivo(d)) {
        const key = `${h.cursoId ?? ""}|${h.asignaturaId}`;
        const prev =
          acum.get(key) ??
          ({
            asignaturaId: h.asignaturaId,
            asignaturaNombre: h.asignaturaNombre,
            cursoId: h.cursoId ?? null,
            sesiones: 0,
            minutos: 0,
            ...(opts.incluirFechas ? { fechas: [] as string[] } : {}),
          } as Acum);

        prev.sesiones += 1;
        prev.minutos += duracionMin;
        if (opts.incluirFechas) prev.fechas!.push(HR_formatYMD(d));

        acum.set(key, prev);
      }
      d = HR_addDays(d, 7);
    }
  }

  const items = Array.from(acum.values())
    .map((r) => ({
      cursoId: r.cursoId,
      asignaturaId: r.asignaturaId,
      asignaturaNombre: r.asignaturaNombre,
      sesiones: r.sesiones,
      minutos: r.minutos,
      horas: +(r.minutos / 60).toFixed(2),
      ...(opts.incluirFechas ? { fechas: r.fechas } : {}),
    }))
    .sort((a, b) => (a.asignaturaNombre || "").localeCompare(b.asignaturaNombre || ""));

  const totalHoras = +(items.reduce((acc, it) => acc + it.minutos, 0) / 60).toFixed(2);

  return {
    desde: HR_formatYMD(desde),
    hasta: HR_formatYMD(hasta),
    festivos,
    items,
    totalHoras,
  };
}

// Handler IPC público
ipcMain.removeHandler("academico.calcular-horas-reales");
ipcMain.handle("academico.calcular-horas-reales", (_e, opts: CalcularHorasOpts = {}) => {
  try {
    const res = calcularHorasLectivas(db as BetterSqlite3.Database, opts);
    return res;
  } catch (err: any) {
    console.error("[academico.calcular-horas-reales] error:", err?.message || err);
    throw err;
  }
});

/* ------------------------------- Ventana ------------------------------- */

const isDev = !app.isPackaged;

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
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../.next/renderer/index.html"));
  }
};

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

inicializarCron(db, app.isPackaged);
/* ------------------------------ Helpers ------------------------------ */

function getEstadoActividad(id: string): string | null {
  try {
    const row = db
      .prepare(`SELECT estado FROM actividades WHERE id = ?`)
      .get(id) as { estado?: string } | undefined;
    return row?.estado ?? null;
  } catch {
    return null;
  }
}

// Helpers de programación
function weekdayEsFromISO(iso: string): string {
  const dt = new Date(iso.replace(" ", "T"));
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return dias[dt.getDay()];
}
function hhmmFromISO(iso: string): string {
  return iso.slice(11, 16);
}
function diffMin(h1: string, h2: string): number {
  const [H1, M1] = h1.split(":").map(Number);
  const [H2, M2] = h2.split(":").map(Number);
  return H2 * 60 + M2 - (H1 * 60 + M1);
}
function addMinutesSameDay(startISO: string, minutes: number): string {
  const date = new Date(startISO.replace(" ", "T") + ":00");
  date.setMinutes(date.getMinutes() + minutes);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${startISO.slice(0, 10)} ${hh}:${mm}`;
}

/* ----------------------- Consultas preparadas (prog) ----------------------- */

const qGetActividadMin = db.prepare(`
  SELECT id, curso_id, asignatura_id
  FROM actividades
  WHERE id = ?
`);

const qHorarioBloque = db.prepare(`
  SELECT id, curso_id, asignatura_id, dia, hora_inicio, hora_fin
  FROM horarios
  WHERE curso_id = ?
    AND asignatura_id = ?
    AND lower(dia) = lower(?)
    AND time(?) >= time(hora_inicio)
    AND time(?) <= time(hora_fin)
  ORDER BY hora_inicio ASC
  LIMIT 1
`);

const qEsFestivo = db.prepare(`
  SELECT 1
  FROM festivos
  WHERE date(?) BETWEEN date(start) AND date(COALESCE(end, start))
  LIMIT 1
`);

const qSolapeProgramadas = db.prepare(`
  WITH ult AS (
    SELECT actividad_id, MAX(rowid) AS max_rowid
    FROM actividad_estado_historial
    GROUP BY actividad_id
  ),
  estados AS (
    SELECT h.actividad_id
    FROM actividad_estado_historial h
    JOIN ult u ON u.actividad_id = h.actividad_id AND u.max_rowid = h.rowid
    WHERE lower(h.estado) = 'programada'
  )
  SELECT a.id
  FROM actividades a
  JOIN estados e ON e.actividad_id = a.id
  WHERE a.curso_id = ?
    AND NOT (datetime(COALESCE(a.programada_fin, a.fecha)) <= datetime(?) OR
             datetime(COALESCE(a.programada_para, a.fecha)) >= datetime(?))
  LIMIT 1
`);

/* --------------------------- IPC handlers: CURSOS --------------------------- */

ipcMain.handle("leer-cursos", () => {
  return db.prepare("SELECT * FROM cursos").all();
});

ipcMain.handle("guardar-curso", (_event, curso) => {
  console.log("📅 Curso recibido en main:", curso);
  const { acronimo, nombre, nivel, grado, clase } = curso;

  if (!acronimo || !nivel || !clase) {
    throw new Error("Faltan campos obligatorios: acrónimo, nivel o clase.");
  }

  const id = `${acronimo}${nivel}${clase}`.toUpperCase();

  db.prepare(
    `
    INSERT OR REPLACE INTO cursos (id, acronimo, nombre, nivel, grado, clase)
    VALUES (@id, @acronimo, @nombre, @nivel, @grado, @clase)
  `
  ).run({
    id,
    acronimo,
    nombre,
    nivel,
    grado,
    clase,
  });

  return { success: true, id };
});

ipcMain.handle("borrar-curso", (_event, id: string) => {
  const stmt = db.prepare("DELETE FROM cursos WHERE id = ?");
  return stmt.run(id);
});

/* --------------------------- IPC handlers: NOMBRES -------------------------- */

ipcMain.handle("leer-nombres", () => {
  return db.prepare("SELECT * FROM nombres").all();
});

ipcMain.handle("guardar-nombre", (_event, nombre: string) => {
  db.prepare("INSERT INTO nombres (nombre) VALUES (?)").run(nombre);
});

/* ------------------------ IPC handlers: ASIGNATURAS ------------------------ */

ipcMain.handle(
  "actualizar-color-asignatura",
  (_event, id: string, color: string) => {
    const stmt = db.prepare(`UPDATE asignaturas SET color = ? WHERE id = ?`);
    stmt.run(color, id);
  }
);

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

ipcMain.handle("guardar-asignatura", async (_event, asignatura) => {
  try {
    // Admite el objeto remoto directamente
    const { id, nombre, creditos, descripcion, RA, color } = asignatura ?? {};

    // Requisitos mínimos
    if (!id || !nombre) {
      throw new Error("Faltan campos obligatorios: id y nombre.");
    }

    // Normalización para columnas TEXT del esquema actual
    const row = {
      id: String(id),
      nombre: String(nombre),
      creditos: creditos != null ? String(creditos) : "",
      descripcion: toText(descripcion ?? {}), // en tu DB es TEXT
      RA: toText(RA ?? []), // en tu DB es TEXT
      color: color ? String(color) : "#4B5563",
    };

    // UPSERT por id (reemplaza si existe)
    const stmt = db.prepare(`
      INSERT INTO asignaturas (id, nombre, creditos, descripcion, RA, color)
      VALUES (@id, @nombre, @creditos, @descripcion, @RA, @color)
      ON CONFLICT(id) DO UPDATE SET
        nombre      = excluded.nombre,
        creditos    = excluded.creditos,
        descripcion = excluded.descripcion,
        RA          = excluded.RA,
        color       = excluded.color
    `);

    stmt.run(row);

    return { success: true, id: row.id };
  } catch (error) {
    console.error("❌ Error al guardar asignatura:", error);
    throw error;
  }
});

ipcMain.handle("leer-asignatura", (_evt, asignaturaId: string) => {
  const row = db
    .prepare("SELECT * FROM asignaturas WHERE id = ?")
    .get(asignaturaId) as
    | {
        id: string;
        nombre: string;
        creditos: string;
        descripcion: string;
        RA?: string; // puede venir como JSON string
        color?: string;
      }
    | undefined;

  if (!row) return null;

  // Si RA viene como string JSON, lo parseamos
  let ra: any[] = [];
  try {
    const raw = (row as any).RA ?? (row as any).ra;
    ra = raw ? JSON.parse(raw) : [];
  } catch {
    ra = [];
  }

  return { ...row, ra }; // normalizamos a `ra`
});

ipcMain.handle("leer-asignaturas", () => {
  const rows = db.prepare("SELECT * FROM asignaturas").all() as {
    id: string;
    nombre: string;
    creditos: string;
    descripcion: string; // texto plano
    RA: string; // JSON string
    color: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    creditos: row.creditos ?? null,
    descripcion: row.descripcion, // ← texto plano, NO JSON.parse
    RA: JSON.parse(row.RA), // ← JSON real con RA y CE
    color: row.color,
  }));
});

ipcMain.handle("leer-asignaturas-curso", (_event, cursoId: string) => {
  if (!cursoId) return [];

  const rows = db
    .prepare(
      `SELECT
       a.id,
       a.nombre,
       a.creditos,
       a.descripcion,
       a.RA,
       a.color
     FROM asignaturas a
     JOIN curso_asignatura ca ON ca.asignatura_id = a.id
     WHERE ca.curso_id = ?
     ORDER BY a.nombre COLLATE NOCASE`
    )
    .all(cursoId) as Array<{
    id: string;
    nombre: string;
    creditos: string | null;
    descripcion: string | null;
    RA: string | null;
    color: string | null;
  }>;

  const safeParse = (s: string | null) => {
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  return (rows ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    creditos: row.creditos ?? null,
    descripcion: safeParse(row.descripcion),
    RA: safeParse(row.RA) ?? [],
    color: row.color ?? null,
  }));
});

/* --------------------------- IPC handlers: ALUMNOS -------------------------- */

ipcMain.handle("guardar-alumno", async (_event, alumno) => {
  console.log("📩 Guardando alumno en SQLite:", alumno);
  try {
    const stmt = db.prepare(`
      INSERT INTO alumnos (nombre, apellidos, curso, mail)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(alumno.nombre, alumno.apellidos, alumno.curso, alumno.mail);

    return { success: true };
  } catch (error) {
    console.error("❌ Error al guardar alumno en SQLite:", error);
    throw error;
  }
});

ipcMain.handle("leer-alumnos", () => {
  return db.prepare("SELECT * FROM alumnos").all();
});

ipcMain.handle("leer-alumnos-por-curso", (_event, cursoId: string) => {
  const stmt = db.prepare(`SELECT * FROM alumnos WHERE curso = ?`);
  const alumnos = stmt.all(cursoId);
  return alumnos;
});

/* ---------------------------- IPC: HORARIOS CRUD --------------------------- */

ipcMain.handle("guardar-horario", (_e, payload) => {
  const cursoId = String(payload.cursoId ?? "").trim();
  const asignaturaId = String(payload.asignaturaId ?? "").trim();
  const diaRaw = String(payload.dia ?? "")
    .trim()
    .toLowerCase();
  const dia =
    diaRaw === "miercoles"
      ? "miércoles"
      : diaRaw === "sabado"
      ? "sábado"
      : diaRaw;
  const horaInicio = String(payload.horaInicio ?? "").trim();
  const horaFin = String(payload.horaFin ?? "").trim();

  const faltan = [];
  if (!cursoId) faltan.push("cursoId");
  if (!asignaturaId) faltan.push("asignaturaId");
  if (!dia) faltan.push("dia");
  if (!horaInicio) faltan.push("horaInicio");
  if (!horaFin) faltan.push("horaFin");
  if (faltan.length) throw new Error(`Faltan campos (${faltan.join(", ")})`);

  // 👇 Añadimos created_at en el insert
  const insert = db.prepare(`
    INSERT INTO horarios (curso_id, asignatura_id, dia, hora_inicio, hora_fin, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const info = insert.run(cursoId, asignaturaId, dia, horaInicio, horaFin);

  return db
    .prepare(
      `
    SELECT id,
           curso_id      AS cursoId,
           asignatura_id AS asignaturaId,
           dia,
           hora_inicio   AS horaInicio,
           hora_fin      AS horaFin,
           created_at    AS createdAt   -- 👈 devolvemos también la marca temporal
    FROM horarios WHERE id = ?
  `
    )
    .get(info.lastInsertRowid as number);
});

ipcMain.handle(
  "leer-horarios",
  (_e, asignaturaId: string, cursoId?: string) => {
    let query = `
    SELECT 
      id,
      curso_id      AS cursoId,
      asignatura_id AS asignaturaId,
      dia,
      hora_inicio   AS horaInicio,
      hora_fin      AS horaFin
    FROM horarios
    WHERE asignatura_id = ?
  `;
    const params: any[] = [asignaturaId];

    if (cursoId) {
      query += " AND curso_id = ?";
      params.push(cursoId);
    }

    query += `
    ORDER BY 
      CASE lower(dia)
        WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miércoles' THEN 3
        WHEN 'miercoles' THEN 3 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5
        WHEN 'sábado' THEN 6 WHEN 'sabado' THEN 6 WHEN 'domingo' THEN 7
      END,
      hora_inicio
  `;

    return db.prepare(query).all(...params);
  }
);

/* --------------------- IPC: HORARIOS de FULLCALENDAR (stub) -------------------- */

/* ---------------- IPC: ASOCIAR ASIGNATURAS A LOS CURSOS ---------------- */

ipcMain.handle(
  "asociar-asignaturas-curso",
  (_event, cursoId: string, asignaturaIds: string[]) => {
    db.prepare("DELETE FROM curso_asignatura WHERE curso_id = ?").run(cursoId);

    const insert = db.prepare(
      "INSERT INTO curso_asignatura (curso_id, asignatura_id) VALUES (?, ?)"
    );
    for (const asigId of asignaturaIds) {
      insert.run(cursoId, asigId);
    }
    return true;
  }
);

/* ---------------- IPC: ACTIVIDADES POR ASIGNATURA / CURSO ---------------- */

// main.ts
ipcMain.handle("actividades-de-curso", (_event, cursoId: string) => {
  const stmt = db.prepare(`
    WITH ult AS (
      SELECT h.actividad_id, MAX(h.rowid) AS max_rowid
      FROM actividad_estado_historial h
      GROUP BY h.actividad_id
    ),
    estados AS (
      SELECT h.actividad_id, lower(h.estado) AS estado
      FROM actividad_estado_historial h
      JOIN ult u ON u.actividad_id = h.actividad_id AND u.max_rowid = h.rowid
    ),
    media_final AS (
      SELECT actividad_id, AVG(nota) AS media
      FROM actividad_nota
      GROUP BY actividad_id
    )
    SELECT 
      a.id,
      a.nombre,
      a.fecha,
      a.curso_id,
      a.asignatura_id,
      a.descripcion,
      a.umbral_aplicado,
      a.analisis_fecha,
      a.programada_para,
      a.programada_fin,
      a.evaluada_fecha,                      -- 👈 AÑADIDO
      COALESCE(a.estado, e.estado) AS estado_derivado,
      CASE
        WHEN lower(COALESCE(a.estado, e.estado)) = 'evaluada'
        THEN ROUND(mf.media, 1)
        ELSE NULL
      END AS nota_media
    FROM actividades a
    LEFT JOIN estados     e  ON e.actividad_id   = a.id
    LEFT JOIN media_final mf ON mf.actividad_id  = a.id
    WHERE a.curso_id = ?
    ORDER BY date(a.fecha) ASC, a.nombre ASC
  `);

  const rows = stmt.all(cursoId) as any[];

  return rows.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    fecha: a.fecha ?? "",
    cursoId: a.curso_id,
    asignaturaId: a.asignatura_id,
    descripcion: a.descripcion ?? "",
    estado: a.estado_derivado ?? "borrador",
    analisisFecha: a.analisis_fecha ?? null,
    umbralAplicado: a.umbral_aplicado ?? null,
    programada_para: a.programada_para ?? null,
    programada_fin: a.programada_fin ?? null,
    evaluada_fecha: a.evaluada_fecha ?? null, // 👈 AÑADIDO
    nota_media: a.nota_media ?? null,
    notaMedia: a.nota_media ?? null,
  }));
});

/* -------------------- IPC: RA/CE y análisis de actividades ------------------- */

ipcMain.handle("obtener-ra-por-asignatura", (_event, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT id, codigo, descripcion
    FROM ra
    WHERE asignatura_id = ?
    ORDER BY codigo
  `);
  return stmt.all(asignaturaId);
});

ipcMain.handle("obtener-ce-por-ra", (_event, raId: string) => {
  const stmt = db.prepare(`
    SELECT id, codigo, descripcion
    FROM ce
    WHERE ra_id = ?
    ORDER BY codigo
  `);
  return stmt.all(raId);
});

ipcMain.handle("analizar-descripcion", async (_e, actividadId: string) => {
  const resultado = await analizarDescripcionActividad(actividadId);
  return resultado;
});

ipcMain.handle(
  "analizar-descripcion-desde-texto",
  async (_event, texto: string, asignaturaId: string) => {
    const resultado = await analizarTextoPlano(texto, asignaturaId);
    return resultado;
  }
);

ipcMain.handle("extraer-texto-pdf", async (_event, filePath: string) => {
  app.whenReady().then(() => {
    createWindow();
    // Arranca tareas programadas; pásale si está empaquetado si lo necesitas
    try {
      inicializarCron(db, app.isPackaged);
    } catch (e) {
      console.error("Cron no pudo inicializarse:", e);
    }
  });
});

/* --------------------------- Archivos PDF (guardar) ------------------------- */

const rutaPDFs = path.join(__dirname, "..", "data", "archivos_pdf");
if (!fs.existsSync(rutaPDFs)) {
  fs.mkdirSync(rutaPDFs, { recursive: true });
}

ipcMain.handle(
  "guardar-informe-pdf",
  async (_e, data: Uint8Array, sugerido: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Guardar informe PDF",
      defaultPath: sugerido,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, Buffer.from(data));
    return { ok: true, filePath };
  }
);

/* -------------------- Guardar/leer análisis y su historial ------------------- */

ipcMain.handle(
  "actividad.guardar-analisis",
  (
    _e,
    payload: {
      actividadId: string;
      umbral: number;
      ces: {
        codigo: string;
        puntuacion: number;
        reason?: "evidence" | "high_sim" | "lang_rule";
        evidencias?: string[];
      }[];
    }
  ) => {
    const { actividadId, umbral, ces } = payload || {};
    if (!actividadId) throw new Error("actividadId requerido");
    if (typeof umbral !== "number") throw new Error("umbral requerido");
    if (!Array.isArray(ces)) throw new Error("ces debe ser un array");

    const nowSql = "datetime('now')";

    const tx = db.transaction(() => {
      // 1) UPSERT de cada CE recibido
      const upsert = db.prepare(`
        INSERT INTO actividad_ce (actividad_id, ce_codigo, puntuacion, razon, evidencias, incluido)
        VALUES (@actividad_id, @ce_codigo, @puntuacion, @razon, @evidencias, @incluido)
        ON CONFLICT(actividad_id, ce_codigo) DO UPDATE SET
          puntuacion = excluded.puntuacion,
          razon      = excluded.razon,
          evidencias = excluded.evidencias,
          incluido   = excluded.incluido
      `);

      // normalizamos entrada
      const codigosRecibidos: string[] = [];
      for (const ce of ces) {
        const ce_codigo = String(ce.codigo).trim();
        if (!ce_codigo) continue;

        const puntuacion = Number(ce.puntuacion ?? 0);
        const incluido = puntuacion >= umbral ? 1 : 0;
        const razon = ce.reason ?? null; // guardamos tal cual
        const evidencias = ce.evidencias ? JSON.stringify(ce.evidencias) : null;

        upsert.run({
          actividad_id: actividadId,
          ce_codigo,
          puntuacion,
          razon,
          evidencias,
          incluido,
        });

        codigosRecibidos.push(ce_codigo);
      }

      // 2) Desactivar CE que existían y NO han venido en este análisis
      if (codigosRecibidos.length > 0) {
        const placeholders = codigosRecibidos.map(() => "?").join(",");
        db.prepare(
          `
          UPDATE actividad_ce
             SET incluido = 0
           WHERE actividad_id = ?
             AND ce_codigo NOT IN (${placeholders})
        `
        ).run(actividadId, ...codigosRecibidos);
      } else {
        // Si no ha venido ninguno, desactiva todos los CE de la actividad
        db.prepare(
          `UPDATE actividad_ce SET incluido = 0 WHERE actividad_id = ?`
        ).run(actividadId);
      }

      // 3) Actualiza actividad (estado + meta)
      db.prepare(
        `UPDATE actividades
            SET estado = 'analizada',
                analisis_fecha = ${nowSql},
                umbral_aplicado = ?
          WHERE id = ?`
      ).run(umbral, actividadId);

      // 4) Historial de estado
      db.prepare(
        `INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
         VALUES (?, ?, 'analizada', ${nowSql}, json_object('umbral', ?))`
      ).run(uuid(), actividadId, umbral);
    });

    tx();
    return { ok: true };
  }
);

ipcMain.handle("actividad.leer-analisis", (_e, actividadId: string) => {
  const meta = db
    .prepare(
      `
    SELECT umbral_aplicado, analisis_fecha
    FROM actividades
    WHERE id = ?
  `
    )
    .get(actividadId) as
    | { umbral_aplicado: number | null; analisis_fecha: string | null }
    | undefined;

  const ces = db
    .prepare(
      `
    SELECT ce_codigo AS codigo, puntuacion, razon, evidencias
    FROM actividad_ce
    WHERE actividad_id = ? Y AND incluido = 1
    ORDER BY puntuacion DESC
  `
    )
    .all(actividadId) as {
    codigo: string;
    puntuacion: number;
    razon?: string;
    evidencias?: string | null;
  }[];

  return {
    umbral: meta?.umbral_aplicado ?? 0,
    fecha: meta?.analisis_fecha ?? null,
    ces: ces.map((c) => ({
      codigo: c.codigo,
      descripcion: "",
      puntuacion: c.puntuacion,
      reason: (c.razon as any) ?? undefined,
      evidencias: c.evidencias ? JSON.parse(c.evidencias) : undefined,
    })),
  };
});

/* ------------------- BORRAR ACTIVIDAD (con validación estado) ---------------- */

const txBorrarActividad = db.transaction((id: string) => {
  db.prepare(`DELETE FROM actividad_ce WHERE actividad_id = ?`).run(id);
  db.prepare(
    `DELETE FROM actividad_estado_historial WHERE actividad_id = ?`
  ).run(id);
  const info = db.prepare(`DELETE FROM actividades WHERE id = ?`).run(id);
  if (info.changes === 0) throw new Error("NOT_FOUND");
});

ipcMain.handle("borrar-actividad", (_event, id: string) => {
  if (!id || typeof id !== "string") throw new Error("ID inválido");

  const estado = getEstadoActividad(id);
  if (estado && !["borrador", "analizada"].includes(estado)) {
    throw new Error(
      "Solo se puede eliminar una actividad en estado 'borrador' o 'analizada'"
    );
  }

  try {
    txBorrarActividad(id);
    return { ok: true };
  } catch (e: any) {
    if (e?.message === "NOT_FOUND") throw new Error("La actividad no existe");
    console.error("Error al borrar actividad:", e);
    throw new Error("No se pudo eliminar la actividad");
  }
});

/* ---------------------- HORARIOS normalizados (consulta) --------------------- */

ipcMain.handle(
  "horarios-de-asignatura",
  (_event, { cursoId, asignaturaId }) => {
    const cols = db
      .prepare("PRAGMA table_info(horarios)")
      .all()
      .map((c: any) => c.name);

    const colDia = cols.includes("dia_semana")
      ? "dia_semana"
      : cols.includes("diaSemana")
      ? "diaSemana"
      : cols.includes("dia")
      ? "dia"
      : null;

    const colInicio = cols.includes("hora_inicio")
      ? "hora_inicio"
      : cols.includes("horaInicio")
      ? "horaInicio"
      : cols.includes("inicio")
      ? "inicio"
      : null;

    const colFin = cols.includes("hora_fin")
      ? "hora_fin"
      : cols.includes("horaFin")
      ? "horaFin"
      : cols.includes("fin")
      ? "fin"
      : null;

    if (!colDia || !colInicio || !colFin) {
      throw new Error(
        `Tabla 'horarios' sin columnas esperadas. Columns: ${cols.join(", ")}`
      );
    }

    const sql = `
    SELECT
      CASE
        WHEN lower(${colDia}) IN ('domingo','dom') THEN 0
        WHEN lower(${colDia}) IN ('lunes','lun')   THEN 1
        WHEN lower(${colDia}) IN ('martes','mar')  THEN 2
        WHEN lower(${colDia}) IN ('miercoles','miércoles','mié','mie') THEN 3
        WHEN lower(${colDia}) IN ('jueves','jue')  THEN 4
        WHEN lower(${colDia}) IN ('viernes','vie') THEN 5
        WHEN lower(${colDia}) IN ('sabado','sábado','sab','sáb') THEN 6
        WHEN CAST(${colDia} AS INTEGER) BETWEEN 0 AND 6 THEN CAST(${colDia} AS INTEGER)
        WHEN CAST(${colDia} AS INTEGER) BETWEEN 1 AND 7 THEN (CAST(${colDia} AS INTEGER) % 7)
        ELSE NULL
      END AS diaSemana,
      ${colInicio} AS horaInicio,
      ${colFin}    AS horaFin
    FROM horarios
    WHERE curso_id = ? AND asignatura_id = ?
  `;

    const rows = db.prepare(sql).all(cursoId, asignaturaId) as {
      diaSemana: number | null;
      horaInicio: string;
      horaFin: string;
    }[];
    return rows.filter((r) => r.diaSemana !== null);
  }
);

/* ----------------------------- Listados y fechas ----------------------------- */

ipcMain.handle("listar-actividades-global", () => {
  const rows = db
    .prepare(
      `
    SELECT
      a.id,
      a.nombre,
      a.fecha,
      a.descripcion,
      a.curso_id        AS cursoId,
      c.nombre          AS cursoNombre,
      a.asignatura_id   AS asignaturaId,
      s.nombre          AS asignaturaNombre,
      COALESCE(a.hora_inicio, a.horaInicio) AS horaInicio,
      COALESCE(a.hora_fin,    a.horaFin)    AS horaFin
    FROM actividades a
    LEFT JOIN cursos c      ON c.id = a.curso_id
    LEFT JOIN asignaturas s ON s.id = a.asignatura_id
    ORDER BY a.fecha ASC, a.nombre ASC
  `
    )
    .all();
  return rows;
});

ipcMain.handle(
  "actualizar-actividad-fecha",
  (_evt, id: string, fecha: string) => {
    db.prepare(`UPDATE actividades SET fecha = ? WHERE id = ?`).run(fecha, id);
    return { ok: true };
  }
);

/* --------------------------- Rango lectivo y festivos ------------------------ */

ipcMain.handle("lectivo:leer", async () => {
  const row = db
    .prepare(`SELECT start, end FROM rango_lectivo WHERE id = 1`)
    .get();
  return row ?? null;
});

ipcMain.handle(
  "lectivo:guardar",
  async (_e, payload: { start: string; end: string }) => {
    const { start, end } = payload || {};
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end)
    ) {
      throw new Error("Formato de fecha inválido. Usa YYYY-MM-DD.");
    }
    const stmt = db.prepare(`
    INSERT INTO rango_lectivo (id, start, end, updated_at)
    VALUES (1, @start, @end, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      start = excluded.start,
      end = excluded.end,
      updated_at = datetime('now')
  `);
    stmt.run({ start, end });
    return { ok: true };
  }
);

ipcMain.handle("festivos:listar", async () => {
  return db
    .prepare(
      `
    SELECT id, start, end, title
    FROM festivos
    ORDER BY start DESC, id DESC
  `
    )
    .all();
});

ipcMain.handle(
  "festivos:crear",
  async (_e, f: { start: string; end?: string | null; title: string }) => {
    const id = randomUUID();
    const startOk = /^\d{4}-\d{2}-\d{2}$/.test(f.start);
    const endOk = !f.end || /^\d{4}-\d{2}-\d{2}$/.test(f.end);
    if (!startOk || !endOk) throw new Error("Fechas inválidas (YYYY-MM-DD).");
    if (!f.title?.trim()) throw new Error("El motivo es obligatorio.");

    db.prepare(
      `INSERT INTO festivos (id, start, end, title) VALUES (@id, @start, @end, @title)`
    ).run({
      id,
      start: f.start,
      end: f.end ?? null,
      title: f.title.trim(),
    });

    return { id, start: f.start, end: f.end ?? null, title: f.title.trim() };
  }
);

ipcMain.handle("festivos:borrar", async (_e, id: string) => {
  db.prepare(`DELETE FROM festivos WHERE id = ?`).run(id);
  return { ok: true };
});

ipcMain.handle(
  "festivos-rango",
  (_event, rango: { start: string; end: string }) => {
    const stmt = db.prepare(`
    SELECT
      id,
      start,
      COALESCE(end, start) AS end,
      title
    FROM festivos
    WHERE date(start) <= date(?)
      AND date(COALESCE(end, start)) >= date(?)
    ORDER BY start ASC
  `);
    return stmt.all(rango.end, rango.start);
  }
);

/* ------------------------- Presencialidades / FCT --------------------------- */

ipcMain.handle("presencialidades-listar", () => {
  const stmt = db.prepare(`
    SELECT id, dia_semana as diaSemana, hora_inicio as horaInicio, hora_fin as horaFin
    FROM presencialidades
    ORDER BY dia_semana ASC, hora_inicio ASC
  `);
  return stmt.all();
});

ipcMain.handle(
  "presencialidades-crear",
  (_event, p: { diaSemana: number; horaInicio: string; horaFin: string }) => {
    const id = uuidv4();
    const stmt = db.prepare(`
    INSERT INTO presencialidades (id, dia_semana, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?)
  `);
    try {
      stmt.run(id, p.diaSemana, p.horaInicio, p.horaFin);
      return { id, ...p };
    } catch (e: any) {
      if (e?.message?.includes("UNIQUE")) {
        throw new Error(
          "Ya existe una presencialidad con ese día y franja horaria."
        );
      }
      throw e;
    }
  }
);

ipcMain.handle("presencialidades-borrar", (_event, id: string) => {
  const stmt = db.prepare(`DELETE FROM presencialidades WHERE id = ?`);
  stmt.run(id);
  return { ok: true };
});

ipcMain.handle("fct-listar", () => {
  return db
    .prepare(
      `
    SELECT id, dia_semana AS diaSemana, hora_inicio AS horaInicio, hora_fin AS horaFin
    FROM fct_tramos
    ORDER BY dia_semana ASC, hora_inicio ASC
  `
    )
    .all();
});

ipcMain.handle(
  "fct-crear",
  (_event, p: { diaSemana: number; horaInicio: string; horaFin: string }) => {
    const id = uuidv4();
    const stmt = db.prepare(
      `INSERT INTO fct_tramos (id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`
    );
    try {
      stmt.run(id, p.diaSemana, p.horaInicio, p.horaFin);
      return { id, ...p };
    } catch (e: any) {
      if (e?.message?.includes("UNIQUE")) {
        throw new Error("Ya existe una FCT con ese día y franja horaria.");
      }
      throw e;
    }
  }
);

ipcMain.handle("fct-borrar", (_event, id: string) => {
  db.prepare(`DELETE FROM fct_tramos WHERE id = ?`).run(id);
  return { ok: true };
});

/* ------------------------------ Borrar horario ------------------------------ */

type BorrarHorarioPayload = {
  cursoId?: string;
  asignaturaId?: string;
  dia?: string;
  horaInicio?: string;
};

ipcMain.removeHandler("borrar-horario");

ipcMain.handle("borrar-horario", (_event, payload: BorrarHorarioPayload) => {
  console.log("[borrar-horario] payload:", payload);

  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido");
  }

  const { cursoId, asignaturaId, dia, horaInicio } = payload;

  if (!cursoId || !asignaturaId || !dia || !horaInicio) {
    throw new Error(
      "Faltan parámetros: cursoId, asignaturaId, dia, horaInicio"
    );
  }

  const norm = (d: string) => {
    const x = (d || "").trim().toLowerCase();
    if (x === "miercoles") return "miércoles";
    if (x === "sabado") return "sábado";
    return x;
  };

  const params = {
    curso_id: cursoId,
    asignatura_id: asignaturaId,
    dia: norm(dia),
    hora_inicio: horaInicio,
  };

  const sql = `
    DELETE FROM horarios
    WHERE curso_id = @curso_id
      AND asignatura_id = @asignatura_id
      AND dia = @dia
      AND hora_inicio = @hora_inicio
  `;

  console.log("[borrar-horario] SQL:", sql, params);

  const info = db.prepare(sql).run(params);
  return { ok: info.changes > 0, changes: info.changes };
});

/* ------------------- NUEVO: Programación de actividades -------------------- */

/** Listar duraciones posibles: 1h..máximo del bloque actual (sin cruzar bloque) */
ipcMain.handle(
  "actividad:duraciones-posibles",
  (_e, payload: { actividadId: string; startISO: string }) => {
    try {
      const { actividadId, startISO } = payload || {};
      if (!actividadId || !startISO) {
        return { success: false, error: "Parámetros incompletos" };
      }

      // YYYY-MM-DD de la fecha seleccionada
      const ymd = startISO.slice(0, 10);

      // ⛔ no permitir fuera del periodo lectivo
      if (!lectivoContains(ymd)) {
        return {
          success: false,
          error: "La fecha está fuera del periodo lectivo",
        };
      }

      // ⛔ no permitir pasado
      if (ymd < hoyYYYYMMDD()) {
        return {
          success: false,
          error: "No hay duraciones para fechas pasadas",
        };
      }

      // Buscar datos mínimos de la actividad
      const act = qGetActividadMin.get(actividadId) as
        | { id: string; curso_id: string; asignatura_id: string }
        | undefined;
      if (!act) return { success: false, error: "Actividad no encontrada" };

      // ⛔ no permitir festivos
      if (qEsFestivo.get(startISO)) {
        return {
          success: false,
          error: "No se puede programar en un día festivo",
        };
      }

      // Comprobar que la hora cae dentro de un bloque de horario
      const dia = weekdayEsFromISO(startISO);
      const hhmm = hhmmFromISO(startISO);
      const raw = startISO?.trim();
      let dt: Date | null = null;

      if (raw) {
        try {
          // Normaliza: si viene con espacio en lugar de "T"
          const norm = raw.includes(" ") ? raw.replace(" ", "T") : raw;
          dt = new Date(norm);

          if (isNaN(dt.getTime())) {
            console.warn(
              "[Programar] ❌ Fecha inválida tras normalizar:",
              norm
            );
            dt = null;
          }
        } catch (e) {
          console.error("[Programar] Error construyendo Date:", e);
          dt = null;
        }
      }


      console.log("[Programar] startISO crudo:", raw);
      if (dt) {
        console.log(
          "[Programar] JS date:",
          dt.toString(),
          "→ getDay:",
          dt.getDay(),
          "→ HH:mm:",
          dt.getHours().toString().padStart(2, "0") +
            ":" +
            dt.getMinutes().toString().padStart(2, "0")
        );
      } else {
        console.log("[Programar] No se pudo parsear la fecha");
      }
      const bloque = qHorarioBloque.get(
        act.curso_id,
        act.asignatura_id,
        dia,
        hhmm,
        hhmm
      ) as { hora_inicio: string; hora_fin: string } | undefined;

      if (!bloque) {
        return {
          success: false,
          error: "Fuera del horario de la asignatura para ese curso",
        };
      }

      // Duración máxima dentro del bloque
      const maxMin = diffMin(hhmm, bloque.hora_fin);
      if (maxMin < 60) {
        return {
          success: false,
          error: "El tramo disponible es inferior a 1 hora",
        };
      }

      // Opciones en horas enteras
      const opciones: number[] = [];
      for (let m = 60; m <= maxMin; m += 60) opciones.push(m);

      return { success: true, opciones };
    } catch (e) {
      console.error("actividad:duraciones-posibles error:", e);
      return { success: false, error: "Error interno" };
    }
  }
);

/** Programar actividad dentro de un bloque, sin solapes, con historial */
ipcMain.handle(
  "actividad:bloques-dia",
  (_e, payload: { actividadId: string; date: string }) => {
    try {
      const { actividadId, date } = payload || {};
      if (!actividadId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: "Parámetros inválidos" };
      }

      const act = qGetActividadMin.get(actividadId) as
        | { id: string; curso_id: string; asignatura_id: string }
        | undefined;
      if (!act) return { success: false, error: "Actividad no encontrada" };

      const dia = weekdayEsFromISO(`${date} 12:00`);
      // normaliza por si tu tabla guarda "miercoles"/"miércoles"
      const rows = db
        .prepare(
          `
      SELECT hora_inicio AS inicio, hora_fin AS fin
      FROM horarios
      WHERE curso_id = ? AND asignatura_id = ? AND lower(dia) = lower(?)
      ORDER BY hora_inicio ASC
    `
        )
        .all(act.curso_id, act.asignatura_id, dia) as {
        inicio: string;
        fin: string;
      }[];

      return { success: true, bloques: rows };
    } catch (e) {
      console.error("actividad:bloques-dia error", e);
      return { success: false, error: "Error interno" };
    }
  }
);

type HorarioRow = {
  horaInicio: string;
  horaFin: string;
};

type ActMin = { curso_id: string; asignatura_id: string };

type ActividadProgramarPayload = {
  actividadId: string;
  startISO: string; // ISO 8601
  duracionMin: number; // minutos
};

type ActividadProgramarResult = {
  ok: boolean;
  actividadId: string;
  startISO: string;
  endISO: string;
  error?: string;
};

ipcMain.handle(
  "actividad:programar",
  (
    _e,
    { actividadId, startISO, duracionMin }: ActividadProgramarPayload
  ): ActividadProgramarResult => {
    const toIsoNoMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
    const start = new Date(startISO);
    const endISO = toIsoNoMs(new Date(start.getTime() + duracionMin * 60_000));

    db.transaction(() => {
      db.prepare(
        `UPDATE actividades
                  SET estado='programada', programada_para=?, programada_fin=?
                  WHERE id=?`
      ).run(startISO, endISO, actividadId);

      const last = db
        .prepare(
          `SELECT estado FROM actividad_estado_historial
         WHERE actividad_id=? ORDER BY rowid DESC LIMIT 1`
        )
        .get(actividadId) as { estado?: string } | undefined;

      if (!last || last.estado?.toLowerCase() !== "programada") {
        db.prepare(
          `INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha)
           VALUES (lower(hex(randomblob(16))), ?, 'programada', datetime('now'))`
        ).run(actividadId);
      }
    })();

    return { ok: true, actividadId, startISO, endISO };
  }
);

ipcMain.handle(
  "actividad:desprogramar",
  (_e, payload: { actividadId: string }) => {
    const { actividadId } = payload || {};
    if (!actividadId) return { success: false, error: "ID requerido" };

    try {
      // Determinar a qué estado volver (si estaba analizada, volver a 'analizada'; si no, 'borrador')
      const meta = db
        .prepare(
          `
      SELECT COALESCE(analisis_fecha, '') AS analisis_fecha
      FROM actividades
      WHERE id = ?
    `
        )
        .get(actividadId) as { analisis_fecha: string } | undefined;

      const nuevoEstado = meta?.analisis_fecha ? "analizada" : "borrador";

      const tx = db.transaction(() => {
        db.prepare(
          `
        UPDATE actividades
        SET estado = ?,
            programada_para = NULL,
            programada_fin  = NULL
        WHERE id = ?
      `
        ).run(nuevoEstado, actividadId);

        db.prepare(
          `
        INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
        VALUES (?, ?, ?, datetime('now'), json_object('accion', 'desprogramar'))
      `
        ).run(crypto.randomUUID(), actividadId, nuevoEstado);
      });
      tx();

      return { success: true, estado: nuevoEstado };
    } catch (e) {
      console.error("Error al desprogramar:", e);
      return { success: false, error: "Error interno" };
    }
  }
);

function alumnosDeCurso(cursoId: string) {
  return db.prepare(`SELECT id FROM alumnos WHERE curso_id=?`).all(cursoId) as {
    id: string;
  }[];
}

/**
 * Crea (si faltan) las filas en ce_notas para: actividad × (todos los alumnos del curso) × (cada CE)
 * NO pisa notas existentes. Devuelve cuántas filas intentó crear.
 */
ipcMain.handle(
  "ceNotas:seedActividad",
  (_evt, actividadId: string, ceCodigos: string[]) => {
    if (!actividadId || !Array.isArray(ceCodigos) || ceCodigos.length === 0) {
      return { ok: false, error: "actividadId o ceCodigos inválidos." };
    }

    // 1) Curso de la actividad
    const act = db
      .prepare(`SELECT curso_id FROM actividades WHERE id=?`)
      .get(actividadId) as { curso_id?: string } | undefined;

    if (!act?.curso_id) {
      return { ok: false, error: "No se encontró curso_id de la actividad." };
    }

    // 2) Alumnos del curso
    const alumnos = alumnosDeCurso(act.curso_id);

    // 3) Insertar si no existe
    const insert = db.prepare(`
      INSERT OR IGNORE INTO ce_notas (actividad_id, alumno_id, ce_codigo, nota)
      VALUES (?, ?, ?, NULL)
    `);

    const tx = db.transaction(() => {
      for (const al of alumnos) {
        for (const cod of ceCodigos) {
          insert.run(actividadId, al.id, cod);
        }
      }
    });
    tx();

    // 4) Contadores (OPCIONAL)
    const totalInt = alumnos.length * ceCodigos.length;
    return { ok: true, totalInt }; // total intentados
  }
);

// main.ts
ipcMain.handle("guardarActividad", async (_e, payload) => {
  try {
    let { id, nombre, fecha, cursoId, asignaturaId, descripcion } = payload;

    if (fecha?.includes("T")) fecha = fecha.slice(0, 10);
    if (!id || !nombre || !fecha || !cursoId || !asignaturaId)
      throw new Error("Campos requeridos ausentes");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
      throw new Error(`Formato de fecha inválido: ${fecha}`);

    const curso = db.prepare("SELECT 1 FROM cursos WHERE id=?").get(cursoId);
    const asig = db
      .prepare("SELECT 1 FROM asignaturas WHERE id=?")
      .get(asignaturaId);
    if (!curso) throw new Error(`curso_id inexistente: ${cursoId}`);
    if (!asig) throw new Error(`asignatura_id inexistente: ${asignaturaId}`);

    db.prepare(
      `
      INSERT INTO actividades (id, nombre, fecha, curso_id, asignatura_id, descripcion)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(id, nombre, fecha, cursoId, asignaturaId, descripcion ?? null);

    return { ok: true };
  } catch (err: any) {
    console.error("[guardarActividad] Error insert:", err?.message, {
      payload,
    });
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle(
  "actividades.listar-por-asignatura",
  (
    _e,
    { cursoId, asignaturaId }: { cursoId: string; asignaturaId: string }
  ) => {
    return db
      .prepare(
        `
      SELECT
        id,
        nombre,
        fecha,
        estado,
        curso_id      AS cursoId,
        asignatura_id AS asignaturaId,
        analisis_fecha AS analisisFecha
      FROM actividades
      WHERE curso_id = ? AND asignatura_id = ?
      ORDER BY date(fecha) DESC, time(fecha) DESC
    `
      )
      .all(cursoId, asignaturaId);
  }
);

ipcMain.handle("actividad.evaluar", (_e, { actividadId, notas }) => {
  const insertNota = db.prepare(`
    INSERT INTO actividad_nota (actividad_id, alumno_id, nota)
    VALUES (?, ?, ?)
    ON CONFLICT(actividad_id, alumno_id)
    DO UPDATE SET nota = excluded.nota
  `);

  const tx = db.transaction((notas) => {
    for (const { alumnoId, nota } of notas) {
      insertNota.run(actividadId, alumnoId, nota);
    }

    // 1) actualizar estado real
    db.prepare(`UPDATE actividades SET estado = 'evaluada' WHERE id = ?`).run(
      actividadId
    );

    // 2) **historial** (¡nuevo!)
    db.prepare(
      `
      INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
      VALUES (?, ?, 'evaluada', datetime('now'), json_object('accion','evaluar'))
    `
    ).run(crypto.randomUUID(), actividadId);
  });

  tx(notas);
  return { ok: true };
});

ipcMain.handle("alumnos.por-curso", (_e, { cursoId }: { cursoId: string }) => {
  const db = (globalThis as any).db as Database.Database;

  // ¿Existe la tabla curso_alumno?
  const hasCursoAlumno = !!db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name='curso_alumno'`
    )
    .get();

  if (hasCursoAlumno) {
    // Versión normalizada (si algún día usas curso_alumno)
    return db
      .prepare(
        `SELECT a.id, a.nombre, a.apellidos
           FROM curso_alumno ca
           JOIN alumnos a ON a.id = ca.alumno_id
           WHERE ca.curso_id = ?
           ORDER BY a.apellidos COLLATE NOCASE, a.nombre COLLATE NOCASE`
      )
      .all(cursoId);
  }

  // Versión actual (campo curso en alumnos)
  return db
    .prepare(
      `SELECT id, nombre, apellidos
         FROM alumnos
         WHERE curso = ?
         ORDER BY apellidos COLLATE NOCASE, nombre COLLATE NOCASE`
    )
    .all(cursoId);
});

ipcMain.handle(
  "actividad.alumnos",
  (_e, { actividadId }: { actividadId: string }) => {
    const db = (globalThis as any).db as Database.Database;

    // 1) Buscar curso de la actividad
    const act = db
      .prepare(`SELECT curso_id FROM actividades WHERE id = ?`)
      .get(actividadId) as { curso_id: string } | undefined;

    if (!act) {
      console.error("❌ Actividad no encontrada:", actividadId);
      return [];
    }

    // 2) Buscar alumnos del curso (si usas tabla normalizada curso_alumno, usa el JOIN)
    const alumnos = db
      .prepare(
        `SELECT a.id, a.nombre, a.apellidos
       FROM curso_alumno ca
       JOIN alumnos a ON a.id = ca.alumno_id
       WHERE ca.curso_id = ?
       ORDER BY a.apellidos COLLATE NOCASE, a.nombre COLLATE NOCASE`
      )
      .all(act.curso_id);

    return alumnos;
  }
);

ipcMain.handle("actividad:evaluar-y-propagar", (_e, { actividadId }) => {
  if (!actividadId) throw new Error("actividadId requerido");

  const tx = db.transaction((id: string) => {
    // ... aquí haces tus comprobaciones y el upsert a nota_ce (si lo mantienes)

    // 👇 NUEVO: propaga a alumno_ce
    const changes = propagarAlumnoCE(id);
    console.log(`[evaluar] alumno_ce upserts=${changes} para actividad ${id}`);

    // Marca evaluada + historial (lo que ya tenías)
    db.prepare(
      `
      UPDATE actividades
         SET estado = 'evaluada',
             evaluada_fecha = datetime('now')
       WHERE id = ?
    `
    ).run(id);

    db.prepare(
      `
      INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha)
      VALUES (lower(hex(randomblob(16))), ?, 'evaluada', datetime('now'))
    `
    ).run(id);
  });

  tx(actividadId);
  return { ok: true };
});

function propagarAlumnoCE(actividadId: string) {
  // Upsert masivo: para cada alumno con nota en la actividad × cada CE incluido
  const info = db
    .prepare(
      `
    INSERT INTO alumno_ce (id, alumno_id, ce_codigo, actividad_id, nota)
    SELECT
      lower(hex(randomblob(16)))              AS id,
      an.alumno_id                            AS alumno_id,
      ace.ce_codigo                           AS ce_codigo,
      an.actividad_id                         AS actividad_id,
      an.nota                                 AS nota
    FROM actividad_nota an
    JOIN actividad_ce ace
      ON ace.actividad_id = an.actividad_id
     AND ace.incluido = 1
    WHERE an.actividad_id = ?
    ON CONFLICT(alumno_id, ce_codigo, actividad_id)
    DO UPDATE SET
      nota = excluded.nota
    `
    )
    .run(actividadId);

  return info.changes ?? 0; // filas insertadas/actualizadas
}

// Guardar notas de una actividad
ipcMain.handle(
  "actividad:guardar-notas",
  (
    _e,
    payload: {
      actividadId: string;
      notas: { alumnoId: string; nota: number }[];
    }
  ) => {
    const { actividadId, notas } = payload;
    if (!actividadId) throw new Error("actividadId requerido");
    if (!Array.isArray(notas) || notas.length === 0)
      throw new Error("notas vacío");

    // Normalizar y validar notas
    const rows = notas.map((n) => {
      const alumnoId = String(n.alumnoId).trim();
      let nota = Number(n.nota);
      if (!alumnoId) throw new Error("alumnoId vacío");
      if (Number.isNaN(nota)) nota = 0;
      if (nota < 0) nota = 0;
      if (nota > 10) nota = 10;
      return { alumnoId, nota };
    });

    const tx = db.transaction(() => {
      /* === 1) Guardar nota global en actividad_nota === */
      const stmtAct = db.prepare(`
        INSERT INTO actividad_nota (id, actividad_id, alumno_id, nota, updated_at)
        VALUES (@id, @actividadId, @alumnoId, @nota, datetime('now'))
        ON CONFLICT(actividad_id, alumno_id)
        DO UPDATE SET nota = excluded.nota, updated_at = excluded.updated_at
      `);

      for (const r of rows) {
        stmtAct.run({
          id: crypto.randomUUID(),
          actividadId,
          alumnoId: r.alumnoId,
          nota: r.nota,
        });
      }

      /* === 2) Replicar a alumno_ce (nota global → cada CE de la actividad) === */
      const stmtAlumnoCE = db.prepare(`
        INSERT INTO alumno_ce (id, alumno_id, ce_codigo, actividad_id, nota)
        SELECT
          lower(hex(randomblob(16))) AS id,
          an.alumno_id,
          ac.ce_codigo,
          an.actividad_id,
          an.nota
        FROM actividad_nota an
        JOIN actividad_ce ac ON ac.actividad_id = an.actividad_id
        WHERE an.actividad_id = @actividadId
        ON CONFLICT(alumno_id, ce_codigo, actividad_id)
        DO UPDATE SET nota = excluded.nota
      `);
      stmtAlumnoCE.run({ actividadId });

      /* === 3) Consolidar en nota_ce (alumno × asignatura × CE) === */
      const stmtNotaCE = db.prepare(`
        INSERT INTO nota_ce (alumno_id, asignatura_id, ce_codigo, nota, updated_at)
        SELECT
          ac.alumno_id,
          act.asignatura_id,
          ac.ce_codigo,
          ac.nota,
          datetime('now')
        FROM alumno_ce ac
        JOIN actividades act ON act.id = ac.actividad_id
        WHERE ac.actividad_id = @actividadId
        ON CONFLICT (alumno_id, asignatura_id, ce_codigo)
        DO UPDATE SET nota = excluded.nota, updated_at = excluded.updated_at
      `);
      stmtNotaCE.run({ actividadId });
    });

    tx();
    return { ok: true, count: rows.length };
  }
);

function ensureIndexes() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- Evita duplicados de RA y CE a nivel "catálogo oficial"
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_asig_codigo ON ra(asignatura_id, codigo);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ce_ra_codigo   ON ce(ra_id, codigo);
  `);
}
ensureIndexes();

/* ===== Tipos del JSON remoto que ya traes en el UI ===== */
type CEJson = { codigo: string; descripcion: string };
type RAJson = { codigo: string; descripcion: string; CE: CEJson[] };

/** Transacción para importar RA y CE oficiales */
const importarRaCeTx = db.transaction(
  (asignaturaId: string, raList: RAJson[]) => {
    const insertRA = db.prepare(`
    INSERT INTO ra (id, codigo, descripcion, asignatura_id)
    VALUES (@id, @codigo, @descripcion, @asignatura_id)
    ON CONFLICT(id) DO UPDATE SET
      descripcion = excluded.descripcion
  `);

    const insertCE = db.prepare(`
    INSERT INTO ce (id, codigo, descripcion, ra_id)
    VALUES (@id, @codigo, @descripcion, @ra_id)
    ON CONFLICT(id) DO UPDATE SET
      descripcion = excluded.descripcion
  `);

    let raCount = 0,
      ceCount = 0;

    for (const ra of raList || []) {
      const raId = `${asignaturaId}:${ra.codigo}`;
      insertRA.run({
        id: raId,
        codigo: ra.codigo,
        descripcion: ra.descripcion,
        asignatura_id: asignaturaId,
      });
      raCount++;

      for (const ce of ra.CE || []) {
        const ceId = `${asignaturaId}:${ra.codigo}:${ce.codigo}`;
        insertCE.run({
          id: ceId,
          codigo: ce.codigo,
          descripcion: ce.descripcion,
          ra_id: raId,
        });
        ceCount++;
      }
    }

    return { raCount, ceCount };
  }
);

/** Handler único que llamas desde el UI tras guardar la asignatura */
ipcMain.handle(
  "asignatura:guardar-e-importar-ra-ce",
  (_e, payload: { asignaturaId: string; raList: RAJson[] }) => {
    const { asignaturaId, raList } = payload || {};
    if (!asignaturaId || !Array.isArray(raList)) {
      throw new Error("asignaturaId y raList son requeridos");
    }
    ensureIndexes();
    const result = importarRaCeTx(asignaturaId, raList);
    return { ok: true, ...result };
  }
);

ipcMain.handle("catalogo:ce-por-asignatura", (_e, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT ce.codigo  AS ceCodigo,
           ce.descripcion,
           ra.codigo  AS raCodigo
    FROM ce
    JOIN ra ON ra.id = ce.ra_id
    WHERE ra.asignatura_id = ?
    ORDER BY ra.codigo, ce.codigo
  `);
  return stmt.all(asignaturaId);
});

ipcMain.handle("leer-notas-asignatura", (_e, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT ra.codigo      AS ra_codigo,
           ce.codigo      AS ce_codigo,
           ce.descripcion AS ce_desc,
           a.id           AS alumno_id,
           a.nombre       AS alumno_nombre,
           a.apellidos    AS alumno_apellidos,
           n.nota,
           n.actividad_id   -- 👈 añadimos esto
    FROM ra
    JOIN ce ON ce.ra_id = ra.id
    CROSS JOIN alumnos a
    LEFT JOIN nota_ce n
      ON n.alumno_id = a.id
     AND n.asignatura_id = ra.asignatura_id
     AND n.ce_codigo = ce.codigo
    WHERE ra.asignatura_id = ?
    ORDER BY ra.codigo, ce.codigo, a.apellidos
  `);
  return stmt.all(asignaturaId);
});

ipcMain.handle("leer-notas-detalle-asignatura", (_e, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT
      ac.alumno_id,
      ac.ce_codigo,
      ac.actividad_id,
      ac.nota,
      act.fecha   AS actividad_fecha,
      act.nombre  AS actividad_nombre
    FROM alumno_ce ac
    JOIN actividades act
      ON act.id = ac.actividad_id
    WHERE act.asignatura_id = ?
    ORDER BY ac.alumno_id, ac.ce_codigo, act.fecha
  `);
  return stmt.all(asignaturaId);
});

/* -------- utils -------- */
function resolveTemplateDir(templateName: string) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "pdf-templates") // empaquetado
    : path.join(process.cwd(), "pdf-templates"); // dev
  return path.join(base, templateName);
}

const mmToIn = (mm: number) => mm / 25.4;
const parseMargin = (val: unknown, defMm: number) => {
  if (typeof val === "number") return mmToIn(val); // si ya te pasan mm (número)
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v.endsWith("mm")) return mmToIn(parseFloat(v));
    if (v.endsWith("in")) return parseFloat(v);
    const n = Number(v);
    return Number.isFinite(n) ? mmToIn(n) : mmToIn(defMm);
  }
  return mmToIn(defMm);
};

/* -------- handler -------- */

ipcMain.handle("actividades.leer-por-curso", (_e, { cursoId }) => {
  const stmt = db.prepare(`
    WITH media_final AS (
      SELECT actividad_id, AVG(nota) AS media
      FROM actividad_nota
      GROUP BY actividad_id
    ),
    media_ce AS (
      -- media por alumno (de sus CE en la actividad) y luego media entre alumnos
      SELECT actividad_id, AVG(nota_promedio_alumno) AS media
      FROM (
        SELECT actividad_id, alumno_id, AVG(nota) AS nota_promedio_alumno
        FROM nota_ce
        GROUP BY actividad_id, alumno_id
      ) t
      GROUP BY actividad_id
    )
    SELECT
      a.id,
      a.nombre,
      a.fecha,
      a.curso_id        AS cursoId,
      a.asignatura_id   AS asignaturaId,
      a.descripcion,
      a.estado,
      a.analisis_fecha  AS analisisFecha,
      a.programada_para AS programadaPara,
      ROUND(COALESCE(mf.media, mc.media), 1) AS notaMedia
    FROM actividades a
    LEFT JOIN media_final mf ON mf.actividad_id = a.id
    LEFT JOIN media_ce    mc ON mc.actividad_id = a.id
    WHERE a.curso_id = ?
    ORDER BY a.fecha DESC
  `);
  return stmt.all(cursoId);
});

ipcMain.handle("curso:alumnos-medias-asignatura", (_e, cursoId: string) => {
  if (!cursoId) throw new Error("cursoId requerido");

  const asignaturas = db
    .prepare(
      `
      SELECT a.id, a.nombre, COALESCE(a.color,'#4B5563') AS color
      FROM curso_asignatura ca
      JOIN asignaturas a ON a.id = ca.asignatura_id
      WHERE ca.curso_id = ?
      ORDER BY a.nombre
    `
    )
    .all(cursoId) as { id: string; nombre: string; color: string }[];

  const alumnos = db
    .prepare(
      `
      SELECT id, nombre, apellidos, mail
      FROM alumnos
      WHERE curso = ?
      ORDER BY apellidos, nombre
    `
    )
    .all(cursoId) as {
    id: string;
    nombre: string;
    apellidos: string;
    mail?: string | null;
  }[];

  // --- TIPADO AQUÍ ---
  // --- TIPADO ---
  type MediaRow = {
    alumnoId: string;
    asignaturaId: string;
    media: number | string | null;
  };

  const medias = db
    .prepare(
      `
     SELECT
       ac.alumno_id            AS alumnoId,
       act.asignatura_id       AS asignaturaId,
       ROUND(AVG(ac.nota), 2)  AS media
     FROM alumno_ce ac
     JOIN actividades act ON act.id = ac.actividad_id
     WHERE act.curso_id = ?
     GROUP BY ac.alumno_id, act.asignatura_id
   `
    )
    .all(cursoId) as MediaRow[];

  const mediaMap: Record<string, Record<string, number>> = {};

  for (const m of medias) {
    const alumnoId = String(m.alumnoId);
    const asignaturaId = String(m.asignaturaId);
    const valor = m.media == null ? NaN : Number(m.media); // por si viene como string

    if (!mediaMap[alumnoId]) mediaMap[alumnoId] = {};
    if (!Number.isNaN(valor)) mediaMap[alumnoId][asignaturaId] = valor;
  }

  return { asignaturas, alumnos, mediaMap };
});

function toBuffer(
  x: ArrayBuffer | Uint8Array | Buffer | number[] | string
): Buffer {
  if (Buffer.isBuffer(x)) return x;
  if (x instanceof Uint8Array) return Buffer.from(x);
  if (x instanceof ArrayBuffer) return Buffer.from(new Uint8Array(x));
  return Buffer.from(x as any);
}

// 🔎 Importa la función desde varias rutas posibles (según tu build)
function cargarGenerador(): (data: any, opts?: any) => ArrayBuffer {
  const intentos = [
    // si el main compila a dist-electron/, y el código a dist/
    path.join(__dirname, "../lib/pdf/actividadInforme"),
    path.join(__dirname, "../pdf/actividadInforme"),
    // por si estás ejecutando TS directamente
    path.join(process.cwd(), "lib/pdf/actividadInforme"),
    path.join(process.cwd(), "pdf/actividadInforme"),
  ];
  for (const p of intentos) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(p);
      const fn =
        mod.generarPDFInformeActividad ||
        mod.default?.generarPDFInformeActividad;
      if (typeof fn === "function") {
        console.log("[PDF] generador cargado desde:", p);
        return fn;
      }
    } catch (e) {
      // silencia intento fallido
    }
  }
  throw new Error(
    "No se pudo cargar generarPDFInformeActividad desde rutas conocidas"
  );
}

// main.ts
import { buildActividadHTML } from "../lib/pdf/actividadInformeHTML";
import { renderHTMLtoPDF } from "../lib/pdf/renderHTMLtoPDF";

const CHANNEL = "pdf.generar-actividad";
ipcMain.removeHandler(CHANNEL);

ipcMain.handle(CHANNEL, async (_e, data: any, fileName: string) => {
  try {
    console.log("[PDF] ▶︎ llamado con:", { titulo: data?.titulo, fileName });

    // 1) Construimos el HTML (misma lógica que el Dialog)
    const html = buildActividadHTML({
      titulo: data?.titulo,
      fechaISO: data?.fechaISO,
      asignatura: data?.asignatura,
      descripcionHTML: data?.descripcionHTML ?? data?.descripcionHtml,
      umbral: data?.umbral,
      ces: data?.ces,
      raByCe: data?.raByCe ?? {},
      ceDescByCode: data?.ceDescByCode ?? {},
    });

    // 2) Render directo del HTML a PDF
    const pdfBuffer = await renderHTMLtoPDF(html);

    // 3) Guardado en Documentos/SkillForgePDF
    const outDir = path.join(app.getPath("documents"), "SkillForgePDF");
    await fs.promises.mkdir(outDir, { recursive: true });

    const outPath = path.join(
      outDir,
      fileName?.endsWith(".pdf") ? fileName : `${fileName || "Informe"}.pdf`
    );

    await fs.promises.writeFile(outPath, pdfBuffer);
    console.log("[PDF] ✅ guardado:", outPath);
    return { ok: true, path: outPath };
  } catch (err: any) {
    console.error("❌ PDF (html→pdf):", err?.stack || err);
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("informe:generar-html", async (_e, payload) => {
  const { input, suggestedFileName } = payload || {};
  try {
    const html = buildActividadHTML(
      {
        titulo: String(input?.titulo ?? "Actividad"),
        fechaISO: String(input?.fechaISO ?? new Date().toISOString()),
        asignatura: String(input?.asignatura ?? "—"),
        descripcionHtml: String(input?.descripcionHtml ?? "<p>Sin contenido</p>"),
        umbral: Number(input?.umbral ?? 0),
        ces: Array.isArray(input?.ces) ? input.ces : [],
        raByCe: input?.raByCe ?? {},
        ceDescByCode: input?.ceDescByCode ?? {},
      },
      { headerTitle: "Actividad evaluativa" }
    );

    const pdfBuffer = await renderHTMLtoPDF(html);

    const baseName = (suggestedFileName || "Informe_actividad.pdf")
      .replace(/[\/\\:*?"<>|]+/g, "_");

    // Guardar siempre en ~/Documents/ForgeSkillsPDF
    const outDir = path.join(app.getPath("documents"), "ForgeSkillsPDF");
    await fs.promises.mkdir(outDir, { recursive: true });

    const outPath = path.join(outDir, baseName);

    await fs.promises.writeFile(outPath, pdfBuffer);

    console.log("[PDF-HTML] ✅ guardado:", outPath);
    return { ok: true, path: outPath };
  } catch (err: any) {
    console.error("[informe:generar-html] error:", err);
    return { ok: false, error: err?.message || "Error generando PDF" };
  }
});

const backups = new BackupManager(DB_PATH);

// IPC para UI
ipcMain.handle("backup:list", async (_e, kind?: "INC" | "FULL") => {
  try { return { ok: true, list: backups.list(kind) }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
});
ipcMain.handle("backup:now", async (_e, kind: "INC" | "FULL" = "INC") => {
  try { return { ok: true, info: await backups.backup(kind) }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
});
// ipcMain.handle("backup:restore", async (_e, filePath: string) => {
//   try {
//     // 🔒 opcional: cierra tu DB singleton aquí
//     // await closeDbSingleton();
//     await backups.restore(filePath);
//     // await openDbSingleton();
//     return { ok: true };
//   } catch (e: any) {
//     return { ok: false, error: String(e?.message || e) };
//   }
// });

// Planificador: INC cada 20' y FULL cada hora, alineado a reloj
app.whenReady().then(() => {
  const msUntilNext = (stepMin: number) => {
    const now = new Date();
    const next = Math.ceil(now.getMinutes() / stepMin) * stepMin;
    const t = new Date(now);
    t.setMinutes(next === 60 ? 0 : next, 0, 0);
    if (next === 60) t.setHours(now.getHours() + 1);
    return t.getTime() - now.getTime();
  };
  const startEvery = (minutes: number, fn: () => void) =>
    setTimeout(() => { fn(); setInterval(fn, minutes * 60 * 1000); }, msUntilNext(minutes));

  startEvery(20, async () => { try { await backups.backup("INC"); } catch (e) { console.error("[INC]", e); } });
  startEvery(60, async () => { try { await backups.backup("FULL"); } catch (e) { console.error("[FULL]", e); } });
});
