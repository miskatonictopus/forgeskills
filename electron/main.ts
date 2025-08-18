/* main.ts */

import * as dotenv from "dotenv";
dotenv.config();
console.log("🔑 API KEY:", process.env.OPENAI_API_KEY);
import { v4 as uuid } from "uuid"; 
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import { db, initDB } from "./database";
import type { Asignatura } from "../models/asignatura";
import { analizarDescripcionActividad } from "../src/lib/analizarDescripcionActividad";
import { analizarTextoPlano } from "../src/lib/analizarTextoPlano";
import { extraerTextoConMutool } from "../src/lib/extraerTextoMutool";
import { execSync } from "child_process";
import fs from "fs";
import { writeFile } from "node:fs/promises";
import * as crypto from "crypto";
import { randomUUID } from "crypto";
import { v4 as uuidv4 } from "uuid";

db.pragma("foreign_keys = ON");

/* ----------------------------- Utils generales ----------------------------- */

function extraerTextoPDF(path: string): string {
  try {
    const output = execSync(`mutool draw -F text -o - "${path}"`, {
      encoding: "utf-8",
    });
    return output.trim();
  } catch (error) {
    console.error("❌ Error al extraer texto con mutool:", error);
    return "";
  }
}

initDB();

/* ------------------------------- Migraciones -------------------------------- */

function colExists(table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some((r) => r.name === col);
}

function tableExists(table: string) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  return !!row;
}

function ensureSchema() {
  // columnas nuevas en 'actividades'
  if (!colExists("actividades", "estado")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN estado TEXT NOT NULL DEFAULT 'borrador'`).run();
  }
  if (!colExists("actividades", "umbral_aplicado")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN umbral_aplicado INTEGER`).run();
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
  db.prepare(`
    CREATE TABLE IF NOT EXISTS actividad_ce (
      actividad_id TEXT NOT NULL,
      ce_codigo TEXT NOT NULL,
      puntuacion REAL NOT NULL,
      razon TEXT,
      evidencias TEXT,
      incluido INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (actividad_id, ce_codigo)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS actividad_estado_historial (
      id TEXT PRIMARY KEY,
      actividad_id TEXT NOT NULL,
      estado TEXT NOT NULL,              -- 'borrador' | 'analizada' | 'programada' | ...
      fecha TEXT NOT NULL,               -- ISO datetime
      meta TEXT
    )
  `).run();

  // festivos (por si no existiera aún)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS festivos (
      id TEXT PRIMARY KEY,
      start TEXT NOT NULL,               -- "YYYY-MM-DD"
      end   TEXT,                        -- opcional ("YYYY-MM-DD")
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_festivos_start ON festivos (start)`).run();
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS unq_festivos_start_end_title
    ON festivos (start, COALESCE(end, start), title)
  `).run();

  // horarios: asegurar curso_id y crear índices
  if (tableExists("horarios") && !colExists("horarios", "curso_id")) {
    db.prepare(`ALTER TABLE horarios ADD COLUMN curso_id TEXT`).run();
  }

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_horarios_curso_asig_dia
    ON horarios(curso_id, asignatura_id, dia, hora_inicio, hora_fin)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_actividades_prog
    ON actividades(curso_id, programada_para, programada_fin)
  `).run();
}

ensureSchema();

function hoyYYYYMMDD() {
  return new Date().toISOString().slice(0, 10);
}

function lectivoGet(): { start?: string; end?: string } {
  const row = db.prepare(`SELECT start, end FROM rango_lectivo WHERE id = 1`).get() as
    | { start?: string; end?: string }
    | undefined;
  return row || {};
}

/** true si ymd está dentro del lectivo (si existe) */
function lectivoContains(ymd: string): boolean {
  const { start, end } = lectivoGet();
  if (!start || !end) return true; // si no hay rango guardado, no bloqueamos desde backend
  return ymd >= start && ymd <= end;
}


/* ---------------------------- Tablas básicas ---------------------------- */

db.prepare(`
  CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidos TEXT,
    curso TEXT,
    mail TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id TEXT,                -- puede ser NULL si vino de DB antigua; ensureSchema ya lo añade
    asignatura_id TEXT NOT NULL,
    dia TEXT NOT NULL,            -- 'lunes' ... 'viernes'
    hora_inicio TEXT NOT NULL,    -- 'HH:MM'
    hora_fin TEXT NOT NULL        -- 'HH:MM'
  )
`).run();

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

/* ------------------------------ Helpers ------------------------------ */

function getEstadoActividad(id: string): string | null {
  try {
    const row = db.prepare(`SELECT estado FROM actividades WHERE id = ?`).get(id) as { estado?: string } | undefined;
    return row?.estado ?? null;
  } catch {
    return null;
  }
}

// Helpers de programación
function weekdayEsFromISO(iso: string): string {
  const dt = new Date(iso.replace(" ", "T"));
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
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

ipcMain.handle("actualizar-color-asignatura", (_event, id: string, color: string) => {
  const stmt = db.prepare(`UPDATE asignaturas SET color = ? WHERE id = ?`);
  stmt.run(color, id);
});

ipcMain.handle("guardar-asignatura", async (_event, asignatura) => {
  try {
    const { id, nombre, creditos, descripcion, RA } = asignatura;

    if (!id || !nombre || !creditos || !descripcion || !RA) {
      throw new Error("Faltan campos en la asignatura.");
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
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error al guardar asignatura:", error);
    throw error;
  }
});

ipcMain.handle("leer-asignaturas", () => {
  const rows = db.prepare("SELECT * FROM asignaturas").all() as {
    id: string;
    nombre: string;
    creditos: string;
    descripcion: string;
    RA: string;
    color: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    creditos: row.creditos,
    descripcion: JSON.parse(row.descripcion),
    RA: JSON.parse(row.RA),
    color: row.color,
  })) satisfies Asignatura[];
});

ipcMain.handle("leer-asignatura", (_event, asignaturaId: string) => {
  const stmt = db.prepare(`SELECT * FROM asignaturas WHERE id = ?`);
  const row = stmt.get(asignaturaId);
  const typedRow = row as {
    id: string;
    nombre: string;
    descripcion: string;
    creditos: string;
    color: string;
    RA: string;
  };

  if (!row) return null;

  const asignatura = {
    id: typedRow.id,
    nombre: typedRow.nombre,
    descripcion: typedRow.descripcion,
    creditos: typedRow.creditos,
    color: typedRow.color,
    ra: [] as any[],
  };

  try {
    if (typeof typedRow.RA === "string") {
      const rawRA = JSON.parse(typedRow.RA);
      asignatura.ra = rawRA.map((ra: any) => ({
        ...ra,
        ce: ra.CE,
      }));
    }
  } catch (err) {
    console.error("Error al parsear RA:", err);
    asignatura.ra = [];
  }

  console.log("🚀 Asignatura enviada al frontend:", asignatura);
  return asignatura;
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
  const diaRaw = String(payload.dia ?? "").trim().toLowerCase();
  const dia = diaRaw === "miercoles" ? "miércoles" : diaRaw === "sabado" ? "sábado" : diaRaw;
  const horaInicio = String(payload.horaInicio ?? "").trim();
  const horaFin = String(payload.horaFin ?? "").trim();

  const faltan = [];
  if (!cursoId) faltan.push("cursoId");
  if (!asignaturaId) faltan.push("asignaturaId");
  if (!dia) faltan.push("dia");
  if (!horaInicio) faltan.push("horaInicio");
  if (!horaFin) faltan.push("horaFin");
  if (faltan.length) throw new Error(`Faltan campos (${faltan.join(", ")})`);

  const insert = db.prepare(`
    INSERT INTO horarios (curso_id, asignatura_id, dia, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?, ?)
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
           hora_fin      AS horaFin
    FROM horarios WHERE id = ?
  `
    )
    .get(info.lastInsertRowid as number);
});

ipcMain.handle("leer-horarios", (_e, asignaturaId: string, cursoId?: string) => {
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
});

/* --------------------- IPC: HORARIOS de FULLCALENDAR (stub) -------------------- */

/* ---------------- IPC: ASOCIAR ASIGNATURAS A LOS CURSOS ---------------- */

ipcMain.handle("asociar-asignaturas-curso", (_event, cursoId: string, asignaturaIds: string[]) => {
  db.prepare("DELETE FROM curso_asignatura WHERE curso_id = ?").run(cursoId);

  const insert = db.prepare("INSERT INTO curso_asignatura (curso_id, asignatura_id) VALUES (?, ?)");
  for (const asigId of asignaturaIds) {
    insert.run(cursoId, asigId);
  }
  return true;
});

/* ---------------- IPC: LEER ASIGNATURAS DE UN CURSO ---------------- */

ipcMain.handle("leer-asignaturas-curso", (_event, cursoId: string) => {
  const stmt = db.prepare(`
    SELECT a.id, a.nombre, a.color
    FROM asignaturas a
    JOIN curso_asignatura ca ON a.id = ca.asignatura_id
    WHERE ca.curso_id = ?
  `)

  return stmt.all(cursoId)
})


/* ---------------- IPC: ACTIVIDADES POR ASIGNATURA / CURSO ---------------- */

type ActividadCruda = {
  id: string;
  nombre: string;
  fecha: string;
  curso_id: string;
  asignatura_id: string;
  descripcion?: string;
  estado?: string | null;
  analisis_fecha?: string | null;
  umbral_aplicado?: number | null;
};

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
      a.programada_para,       -- NUEVO
      a.programada_fin,        -- NUEVO
      COALESCE(e.estado, a.estado) AS estado_derivado
    FROM actividades a
    LEFT JOIN estados e ON e.actividad_id = a.id
    WHERE a.curso_id = ?
    ORDER BY date(a.fecha) ASC, a.nombre ASC
  `);

  const actividades = stmt.all(cursoId) as Array<{
    id: string;
    nombre: string;
    fecha: string | null;
    curso_id: string;
    asignatura_id: string;
    descripcion?: string | null;
    umbral_aplicado?: number | null;
    analisis_fecha?: string | null;
    programada_para?: string | null;
    programada_fin?: string | null;
    estado_derivado?: string | null;
  }>;

  return actividades.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    fecha: a.fecha ?? "",
    cursoId: a.curso_id,
    asignaturaId: a.asignatura_id,
    descripcion: a.descripcion ?? "",
    estado: a.estado_derivado ?? "borrador",
    analisisFecha: a.analisis_fecha ?? null,
    umbralAplicado: a.umbral_aplicado ?? null,
    programadaPara: a.programada_para ?? null,
    programadaFin: a.programada_fin ?? null,
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

ipcMain.handle("analizar-descripcion-desde-texto", async (_event, texto: string, asignaturaId: string) => {
  const resultado = await analizarTextoPlano(texto, asignaturaId);
  return resultado;
});

ipcMain.handle("extraer-texto-pdf", async (_event, filePath: string) => {
  return extraerTextoPDF(filePath);
});

/* --------------------------- Archivos PDF (guardar) ------------------------- */

const rutaPDFs = path.join(__dirname, "..", "data", "archivos_pdf");
if (!fs.existsSync(rutaPDFs)) {
  fs.mkdirSync(rutaPDFs, { recursive: true });
}

ipcMain.handle("guardar-pdf", async (_event, buffer: ArrayBuffer, nombre: string) => {
  try {
    const rutaFinal = path.join(__dirname, "../data/archivos_pdf", nombre);
    fs.writeFileSync(rutaFinal, Buffer.from(buffer));
    return rutaFinal;
  } catch (error) {
    console.error("❌ Error al guardar el PDF:", error);
    return null;
  }
});

ipcMain.handle("guardar-informe-pdf", async (_e, data: Uint8Array, sugerido: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: "Guardar informe PDF",
    defaultPath: sugerido,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, Buffer.from(data));
  return { ok: true, filePath };
});

/* -------------------- Guardar/leer análisis y su historial ------------------- */

ipcMain.handle("actividad.guardar-analisis", (_e, payload) => {
  const { actividadId, umbral, ces } = payload;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE actividades
      SET estado = 'analizada',
          umbral_aplicado = ?,
          analisis_fecha = ?
      WHERE id = ?
    `
    ).run(umbral, now, actividadId);

    const upsert = db.prepare(`
      INSERT INTO actividad_ce (actividad_id, ce_codigo, puntuacion, razon, evidencias, incluido)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(actividad_id, ce_codigo) DO UPDATE
        SET puntuacion=excluded.puntuacion,
            razon=excluded.razon,
            evidencias=excluded.evidencias,
            incluido=1
    `);

    for (const ce of ces) {
      upsert.run(
        actividadId,
        ce.codigo,
        ce.puntuacion,
        ce.reason ?? null,
        ce.evidencias ? JSON.stringify(ce.evidencias) : null
      );
    }

    db.prepare(
      `
      INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
      VALUES (?, ?, 'analizada', ?, ?)
    `
    ).run(crypto.randomUUID(), actividadId, now, JSON.stringify({ umbral }));
  });

  tx();
  return { ok: true };
});

ipcMain.handle("actividad.leer-analisis", (_e, actividadId: string) => {
  const meta = db
    .prepare(
      `
    SELECT umbral_aplicado, analisis_fecha
    FROM actividades
    WHERE id = ?
  `
    )
    .get(actividadId) as { umbral_aplicado: number | null; analisis_fecha: string | null } | undefined;

  const ces = db
    .prepare(
      `
    SELECT ce_codigo AS codigo, puntuacion, razon, evidencias
    FROM actividad_ce
    WHERE actividad_id = ? AND incluido = 1
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
  db.prepare(`DELETE FROM actividad_estado_historial WHERE actividad_id = ?`).run(id);
  const info = db.prepare(`DELETE FROM actividades WHERE id = ?`).run(id);
  if (info.changes === 0) throw new Error("NOT_FOUND");
});

ipcMain.handle("borrar-actividad", (_event, id: string) => {
  if (!id || typeof id !== "string") throw new Error("ID inválido");

  const estado = getEstadoActividad(id);
  if (estado && !["borrador", "analizada"].includes(estado)) {
    throw new Error("Solo se puede eliminar una actividad en estado 'borrador' o 'analizada'");
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

ipcMain.handle("horarios-de-asignatura", (_event, { cursoId, asignaturaId }) => {
  const cols = db.prepare("PRAGMA table_info(horarios)").all().map((c: any) => c.name);

  const colDia =
    cols.includes("dia_semana") ? "dia_semana" :
    cols.includes("diaSemana") ? "diaSemana" :
    cols.includes("dia") ? "dia" : null;

  const colInicio =
    cols.includes("hora_inicio") ? "hora_inicio" :
    cols.includes("horaInicio") ? "horaInicio" :
    cols.includes("inicio") ? "inicio" : null;

  const colFin =
    cols.includes("hora_fin") ? "hora_fin" :
    cols.includes("horaFin") ? "horaFin" :
    cols.includes("fin") ? "fin" : null;

  if (!colDia || !colInicio || !colFin) {
    throw new Error(`Tabla 'horarios' sin columnas esperadas. Columns: ${cols.join(", ")}`);
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

  const rows = db.prepare(sql).all(cursoId, asignaturaId) as { diaSemana: number | null; horaInicio: string; horaFin: string }[];
  return rows.filter((r) => r.diaSemana !== null);
});

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

ipcMain.handle("actualizar-actividad-fecha", (_evt, id: string, fecha: string) => {
  db.prepare(`UPDATE actividades SET fecha = ? WHERE id = ?`).run(fecha, id);
  return { ok: true };
});

/* --------------------------- Rango lectivo y festivos ------------------------ */

ipcMain.handle("lectivo:leer", async () => {
  const row = db.prepare(`SELECT start, end FROM rango_lectivo WHERE id = 1`).get();
  return row ?? null;
});

ipcMain.handle("lectivo:guardar", async (_e, payload: { start: string; end: string }) => {
  const { start, end } = payload || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
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
});

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

ipcMain.handle("festivos:crear", async (_e, f: { start: string; end?: string | null; title: string }) => {
  const id = randomUUID();
  const startOk = /^\d{4}-\d{2}-\d{2}$/.test(f.start);
  const endOk = !f.end || /^\d{4}-\d{2}-\d{2}$/.test(f.end);
  if (!startOk || !endOk) throw new Error("Fechas inválidas (YYYY-MM-DD).");
  if (!f.title?.trim()) throw new Error("El motivo es obligatorio.");

  db.prepare(`INSERT INTO festivos (id, start, end, title) VALUES (@id, @start, @end, @title)`).run({
    id,
    start: f.start,
    end: f.end ?? null,
    title: f.title.trim(),
  });

  return { id, start: f.start, end: f.end ?? null, title: f.title.trim() };
});

ipcMain.handle("festivos:borrar", async (_e, id: string) => {
  db.prepare(`DELETE FROM festivos WHERE id = ?`).run(id);
  return { ok: true };
});

ipcMain.handle("festivos-rango", (_event, rango: { start: string; end: string }) => {
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
});

/* ------------------------- Presencialidades / FCT --------------------------- */

ipcMain.handle("presencialidades-listar", () => {
  const stmt = db.prepare(`
    SELECT id, dia_semana as diaSemana, hora_inicio as horaInicio, hora_fin as horaFin
    FROM presencialidades
    ORDER BY dia_semana ASC, hora_inicio ASC
  `);
  return stmt.all();
});

ipcMain.handle("presencialidades-crear", (_event, p: { diaSemana: number; horaInicio: string; horaFin: string }) => {
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
      throw new Error("Ya existe una presencialidad con ese día y franja horaria.");
    }
    throw e;
  }
});

ipcMain.handle("presencialidades-borrar", (_event, id: string) => {
  const stmt = db.prepare(`DELETE FROM presencialidades WHERE id = ?`);
  stmt.run(id);
  return { ok: true };
});

ipcMain.handle("fct-listar", () => {
  return db
    .prepare(`
    SELECT id, dia_semana AS diaSemana, hora_inicio AS horaInicio, hora_fin AS horaFin
    FROM fct_tramos
    ORDER BY dia_semana ASC, hora_inicio ASC
  `)
    .all();
});

ipcMain.handle("fct-crear", (_event, p: { diaSemana: number; horaInicio: string; horaFin: string }) => {
  const id = uuidv4();
  const stmt = db.prepare(`INSERT INTO fct_tramos (id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)`);
  try {
    stmt.run(id, p.diaSemana, p.horaInicio, p.horaFin);
    return { id, ...p };
  } catch (e: any) {
    if (e?.message?.includes("UNIQUE")) {
      throw new Error("Ya existe una FCT con ese día y franja horaria.");
    }
    throw e;
  }
});

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
    throw new Error("Faltan parámetros: cursoId, asignaturaId, dia, horaInicio");
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
        return { success: false, error: "La fecha está fuera del periodo lectivo" };
      }

      // ⛔ no permitir pasado
      if (ymd < hoyYYYYMMDD()) {
        return { success: false, error: "No hay duraciones para fechas pasadas" };
      }

      // Buscar datos mínimos de la actividad
      const act = qGetActividadMin.get(actividadId) as
        | { id: string; curso_id: string; asignatura_id: string }
        | undefined;
      if (!act) return { success: false, error: "Actividad no encontrada" };

      // ⛔ no permitir festivos
      if (qEsFestivo.get(startISO)) {
        return { success: false, error: "No se puede programar en un día festivo" };
      }

      // Comprobar que la hora cae dentro de un bloque de horario
      const dia = weekdayEsFromISO(startISO);
      const hhmm = hhmmFromISO(startISO);

      const bloque = qHorarioBloque.get(
        act.curso_id,
        act.asignatura_id,
        dia,
        hhmm,
        hhmm
      ) as { hora_inicio: string; hora_fin: string } | undefined;

      if (!bloque) {
        return { success: false, error: "Fuera del horario de la asignatura para ese curso" };
      }

      // Duración máxima dentro del bloque
      const maxMin = diffMin(hhmm, bloque.hora_fin);
      if (maxMin < 60) {
        return { success: false, error: "El tramo disponible es inferior a 1 hora" };
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
ipcMain.handle("actividad:bloques-dia", (_e, payload: { actividadId: string; date: string }) => {
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
    const rows = db.prepare(`
      SELECT hora_inicio AS inicio, hora_fin AS fin
      FROM horarios
      WHERE curso_id = ? AND asignatura_id = ? AND lower(dia) = lower(?)
      ORDER BY hora_inicio ASC
    `).all(act.curso_id, act.asignatura_id, dia) as { inicio: string; fin: string }[];

    return { success: true, bloques: rows };
  } catch (e) {
    console.error("actividad:bloques-dia error", e);
    return { success: false, error: "Error interno" };
  }
});



ipcMain.handle(
  "actividad:programar",
  (
    _e,
    payload: { actividadId: string; startISO: string; duracionMin: number }
  ) => {
    try {
      // 1) Desestructurar al inicio
      const { actividadId, startISO, duracionMin } = payload || {};
      if (!actividadId || !startISO || !duracionMin) {
        return { success: false, error: "Parámetros incompletos" };
      }
      if (duracionMin <= 0 || duracionMin % 60 !== 0) {
        return { success: false, error: "Duración inválida (múltiplos de 60)" };
      }

      // 2) Validaciones de fecha
      const ymd = startISO.slice(0, 10); // YYYY-MM-DD
      if (ymd < hoyYYYYMMDD()) {
        return { success: false, error: "No puedes programar en fechas pasadas" };
      }
      if (!lectivoContains(ymd)) {
        return {
          success: false,
          error: "La fecha está fuera del periodo lectivo",
        };
      }

      // 3) Buscar actividad
      const act = qGetActividadMin.get(actividadId) as
        | { id: string; curso_id: string; asignatura_id: string }
        | undefined;
      if (!act) return { success: false, error: "Actividad no encontrada" };

      // 4) Festivos
      if (qEsFestivo.get(startISO)) {
        return { success: false, error: "No se puede programar en un día festivo" };
      }

      // 5) Horario de la asignatura
      const dia = weekdayEsFromISO(startISO);
      const hhmmStart = hhmmFromISO(startISO);

      const bloque = qHorarioBloque.get(
        act.curso_id,
        act.asignatura_id,
        dia,
        hhmmStart,
        hhmmStart
      ) as { hora_inicio: string; hora_fin: string } | undefined;

      if (!bloque) {
        return {
          success: false,
          error: "Fuera del horario de la asignatura para ese curso",
        };
      }

      // 6) Duración vs bloque
      const maxMin = diffMin(hhmmStart, bloque.hora_fin);
      if (duracionMin > maxMin) {
        return { success: false, error: "La duración excede el bloque de clase" };
      }

      // 7) Solapes
      const endISO = addMinutesSameDay(startISO, duracionMin);
      const fechaSolo = startISO.slice(0, 10);

      if (qSolapeProgramadas.get(act.curso_id, startISO, endISO)) {
        return { success: false, error: "Solapa con otra actividad programada" };
      }

      // 8) Transacción DB
      const tx = db.transaction(() => {
        db.prepare(
          `
          UPDATE actividades
          SET estado = 'programada',
              programada_para = ?,
              programada_fin  = ?,
              fecha = ?
          WHERE id = ?
        `
        ).run(startISO, endISO, fechaSolo, actividadId);

        db.prepare(
          `
          INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
          VALUES (?, ?, 'programada', datetime('now'), json_object('duracionMin', ?))
        `
        ).run(crypto.randomUUID(), actividadId, duracionMin);
      });
      tx();

      return { success: true, startISO, endISO };
    } catch (err) {
      console.error("Error al programar actividad:", err);
      return { success: false, error: "Error interno" };
    }
  }
);

ipcMain.handle("actividad:desprogramar", (_e, payload: { actividadId: string }) => {
  const { actividadId } = payload || {};
  if (!actividadId) return { success: false, error: "ID requerido" };

  try {
    // Determinar a qué estado volver (si estaba analizada, volver a 'analizada'; si no, 'borrador')
    const meta = db.prepare(`
      SELECT COALESCE(analisis_fecha, '') AS analisis_fecha
      FROM actividades
      WHERE id = ?
    `).get(actividadId) as { analisis_fecha: string } | undefined;

    const nuevoEstado = meta?.analisis_fecha ? "analizada" : "borrador";

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE actividades
        SET estado = ?,
            programada_para = NULL,
            programada_fin  = NULL
        WHERE id = ?
      `).run(nuevoEstado, actividadId);

      db.prepare(`
        INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
        VALUES (?, ?, ?, datetime('now'), json_object('accion', 'desprogramar'))
      `).run(crypto.randomUUID(), actividadId, nuevoEstado);
    });
    tx();

    return { success: true, estado: nuevoEstado };
  } catch (e) {
    console.error("Error al desprogramar:", e);
    return { success: false, error: "Error interno" };
  }
});

function alumnosDeCurso(cursoId: string) {
  return db.prepare(`SELECT id FROM alumnos WHERE curso_id=?`).all(cursoId) as { id: string }[];
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
    if (!id || !nombre || !fecha || !cursoId || !asignaturaId) throw new Error("Campos requeridos ausentes");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Formato de fecha inválido: ${fecha}`);

    const curso = db.prepare("SELECT 1 FROM cursos WHERE id=?").get(cursoId);
    const asig  = db.prepare("SELECT 1 FROM asignaturas WHERE id=?").get(asignaturaId);
    if (!curso) throw new Error(`curso_id inexistente: ${cursoId}`);
    if (!asig)  throw new Error(`asignatura_id inexistente: ${asignaturaId}`);

    db.prepare(`
      INSERT INTO actividades (id, nombre, fecha, curso_id, asignatura_id, descripcion)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, nombre, fecha, cursoId, asignaturaId, descripcion ?? null);

    return { ok: true };
  } catch (err: any) {
    console.error("[guardarActividad] Error insert:", err?.message, { payload });
    return { ok: false, error: String(err?.message || err) };
  }
});

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

ipcMain.handle("pdf:exportFromHTML", async (_e, { html, fileName }: { html: string; fileName?: string }) => {
  if (!html) return { ok: false, error: "HTML vacío" };

  const fullHtml = html.includes("<html")
    ? html
    : `<!doctype html><html><head>
         <meta charset="utf-8"/>
         <meta name="viewport" content="width=device-width, initial-scale=1"/>
         <style>
          html,body{margin:0;padding:0;background:#fff;color:#0a0a0a;font:14px/1.5 -apple-system,Segoe UI,Roboto,Ubuntu,Arial}
          table, tr, td, th { page-break-inside: avoid; }
          h1, h2, h3, p { page-break-after: avoid; }
         </style>
       </head><body>${html}</body></html>`;

  // 1) Escribe a un temporal para evitar PDFs en blanco con data: URL
  const tmpFile = path.join(app.getPath("temp"), `skillforge_export_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, fullHtml, "utf-8");

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });

  try {
    // 2) Carga y espera a que pinte
    await win.loadFile(tmpFile);
    await delay(120); // pequeño margen para layout/Fonts

    // 3) Imprime
    const opts: Electron.PrintToPDFOptions = {
      pageSize: "A4",
      landscape: false,
      printBackground: true,
      margins: { marginType: "default" }, // o: { marginType: "custom", top:0, bottom:0, left:0, right:0 }
    };
    const pdfBuffer = await win.webContents.printToPDF(opts);

    // 4) Guardar
    const { filePath } = await dialog.showSaveDialog({
      title: "Guardar PDF",
      defaultPath: path.join(app.getPath("documents"), fileName || "documento.pdf"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!filePath) return { ok: false, error: "Cancelado por el usuario" };

    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, path: filePath };
  } catch (err: any) {
    console.error("printToPDF error:", err);
    return { ok: false, error: String(err?.message || err) };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fs.unlink(tmpFile, () => {});
  }
});