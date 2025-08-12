import * as dotenv from "dotenv";
dotenv.config();
console.log("🔑 API KEY:", process.env.OPENAI_API_KEY);
import { app, BrowserWindow, ipcMain, dialog } from "electron"
import * as path from "path"
import { db, initDB } from "./database"
import type { Asignatura } from "../models/asignatura"
import { analizarDescripcionActividad } from "../src/lib/analizarDescripcionActividad";
import { analizarTextoPlano } from "../src/lib/analizarTextoPlano";
import { extraerTextoConMutool } from "../src/lib/extraerTextoMutool";
import { execSync } from "child_process";
import fs from "fs";
import { writeFile } from "node:fs/promises"; // o: import * as fs from "
import * as crypto from "crypto";

db.pragma("foreign_keys = ON");

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

initDB()

// --- Migración idempotente (better-sqlite3) ---
function colExists(table: string, col: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some(r => r.name === col);
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
    db.prepare(`ALTER TABLE actividades ADD COLUMN programada_para TEXT`).run();
  }
  if (!colExists("actividades", "programada_fin")) {
    db.prepare(`ALTER TABLE actividades ADD COLUMN programada_fin TEXT`).run();
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
      estado TEXT NOT NULL,
      fecha TEXT NOT NULL,
      meta TEXT
    )
  `).run();
}

// Llama al iniciar la app, antes de registrar handlers IPC
ensureSchema();



// Tabla ALUMNOS

db.prepare(`
  CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    apellidos TEXT,
    curso TEXT,
    mail TEXT
  )
`).run()

// Tabla HORARIOS

db.prepare(`
  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asignatura_id TEXT NOT NULL,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL
  )
`).run()

const isDev = !app.isPackaged

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

function getEstadoActividad(id: string): string | null {
  try {
    const row = db
      .prepare(`SELECT estado FROM actividades WHERE id = ?`)
      .get(id) as { estado?: string } | undefined;
    return row?.estado ?? null;
  } catch {
    // Si no existe la columna, no bloqueamos el borrado por estado
    return null;
  }
}

// ---------------------------
// IPC handlers para CURSOS
// ---------------------------

ipcMain.handle("leer-cursos", () => {
  return db.prepare("SELECT * FROM cursos").all()
})

ipcMain.handle("guardar-curso", (_event, curso) => {
  console.log("📅 Curso recibido en main:", curso)
  const { acronimo, nombre, nivel, grado, clase } = curso

  if (!acronimo || !nivel || !clase) {
    throw new Error("Faltan campos obligatorios: acrónimo, nivel o clase.")
  }

  const id = `${acronimo}${nivel}${clase}`.toUpperCase()

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
  })

  return { success: true, id }
})

ipcMain.handle("borrar-curso", (event, id: string) => {
  const stmt = db.prepare("DELETE FROM cursos WHERE id = ?")
  return stmt.run(id)
})


// ---------------------------
// IPC handlers para NOMBRES
// ---------------------------

ipcMain.handle("leer-nombres", () => {
  return db.prepare("SELECT * FROM nombres").all()
})

ipcMain.handle("guardar-nombre", (_event, nombre: string) => {
  db.prepare("INSERT INTO nombres (nombre) VALUES (?)").run(nombre)
})

// ---------------------------
// IPC handler para ASIGNATURAS
// ---------------------------

ipcMain.handle("actualizar-color-asignatura", (event, id: string, color: string) => {
  const stmt = db.prepare(`UPDATE asignaturas SET color = ? WHERE id = ?`)
  stmt.run(color, id)
})


ipcMain.handle("guardar-asignatura", async (_event, asignatura) => {
  try {
    const { id, nombre, creditos, descripcion, RA } = asignatura

    if (!id || !nombre || !creditos || !descripcion || !RA) {
      throw new Error("Faltan campos en la asignatura.")
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
    })

    return { success: true }
  } catch (error) {
    console.error("❌ Error al guardar asignatura:", error)
    throw error
  }
})

ipcMain.handle("leer-asignaturas", () => {
  const rows = db.prepare("SELECT * FROM asignaturas").all() as {
    id: string
    nombre: string
    creditos: string
    descripcion: string
    RA: string
    color: string // ✅ añadimos color aquí también
  }[]

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    creditos: row.creditos,
    descripcion: JSON.parse(row.descripcion),
    RA: JSON.parse(row.RA),
    color: row.color, // ✅ ahora se incluye en el resultado
  })) satisfies Asignatura[]
})

ipcMain.handle("leer-asignatura", (event, asignaturaId: string) => {
  const stmt = db.prepare(`SELECT * FROM asignaturas WHERE id = ?`)
  const row = stmt.get(asignaturaId)
  const typedRow = row as {
    id: string
    nombre: string
    descripcion: string
    creditos: string
    color: string
    RA: string
  }

  if (!row) return null

  const asignatura = {
    id: typedRow.id,
    nombre: typedRow.nombre,
    descripcion: typedRow.descripcion,
    creditos: typedRow.creditos,
    color: typedRow.color,
    ra: [],
  }

  try {
    if (typeof typedRow.RA === "string") {
      const rawRA = JSON.parse(typedRow.RA)
      asignatura.ra = rawRA.map((ra: any) => ({
        ...ra,
        ce: ra.CE, // <- Renombramos aquí
      }))
    }
  } catch (err) {
    console.error("Error al parsear RA:", err)
    asignatura.ra = []
  }

  console.log("🚀 Asignatura enviada al frontend:", asignatura)
  return asignatura
})




// ---------------------------
// IPC handler para ALUMNOS
// ---------------------------

ipcMain.handle("guardar-alumno", async (_event, alumno) => {
  console.log("📩 Guardando alumno en SQLite:", alumno)
  try {
    const stmt = db.prepare(`
      INSERT INTO alumnos (nombre, apellidos, curso, mail)
      VALUES (?, ?, ?, ?)
    `)

    stmt.run(
      alumno.nombre,
      alumno.apellidos,
      alumno.curso,
      alumno.mail
    )

    return { success: true }
  } catch (error) {
    console.error("❌ Error al guardar alumno en SQLite:", error)
    throw error
  }
})

ipcMain.handle("leer-alumnos", () => {
  return db.prepare("SELECT * FROM alumnos").all()
})

ipcMain.handle("leer-alumnos-por-curso", (event, cursoId: string) => {
  const stmt = db.prepare(`SELECT * FROM alumnos WHERE curso = ?`)
  const alumnos = stmt.all(cursoId)
  return alumnos
})

// ---------------------------
// IPC handler para HORARIOS
// ---------------------------


ipcMain.handle("guardar-horario", (e, payload) => {
  const cursoId      = String(payload.cursoId ?? "").trim();
  const asignaturaId = String(payload.asignaturaId ?? "").trim();
  const diaRaw       = String(payload.dia ?? "").trim().toLowerCase();
  const dia          = diaRaw === "miercoles" ? "miércoles" : diaRaw === "sabado" ? "sábado" : diaRaw;
  const horaInicio   = String(payload.horaInicio ?? "").trim();
  const horaFin      = String(payload.horaFin ?? "").trim();

  const faltan = [];
  if (!cursoId)      faltan.push("cursoId");
  if (!asignaturaId) faltan.push("asignaturaId");
  if (!dia)          faltan.push("dia");
  if (!horaInicio)   faltan.push("horaInicio");
  if (!horaFin)      faltan.push("horaFin");
  if (faltan.length) throw new Error(`Faltan campos (${faltan.join(", ")})`);

  const insert = db.prepare(`
    INSERT INTO horarios (curso_id, asignatura_id, dia, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = insert.run(cursoId, asignaturaId, dia, horaInicio, horaFin);

  return db.prepare(`
    SELECT id,
           curso_id      AS cursoId,
           asignatura_id AS asignaturaId,
           dia,
           hora_inicio   AS horaInicio,
           hora_fin      AS horaFin
    FROM horarios WHERE id = ?
  `).get(info.lastInsertRowid as number);
});

ipcMain.handle("leer-horarios", (e, asignaturaId: string, cursoId?: string) => {
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
// ---------------------------
// IPC handler para HORARIOS de FULLCALENDAR
// ---------------------------


// ---------------------------
// IPC handler para ASOCIAR ASIGNATURAS A LOS CURSOS
// ---------------------------

ipcMain.handle("asociar-asignaturas-curso", (event, cursoId: string, asignaturaIds: string[]) => {
  db.prepare("DELETE FROM curso_asignatura WHERE curso_id = ?").run(cursoId)

  const insert = db.prepare(
    "INSERT INTO curso_asignatura (curso_id, asignatura_id) VALUES (?, ?)"
  )

  for (const asigId of asignaturaIds) {
    insert.run(cursoId, asigId)
  }

  return true
})

// ---------------------------
// IPC handler para LEER LAS ASIGNATURAS DE LOS CURSOS
// ---------------------------

ipcMain.handle("leer-asignaturas-curso", (event, cursoId: string) => {
  const stmt = db.prepare(`
    SELECT a.id, a.nombre
    FROM asignaturas a
    JOIN curso_asignatura ca ON a.id = ca.asignatura_id
    WHERE ca.curso_id = ?
  `)

  return stmt.all(cursoId)
})

// ---------------------------
// IPC handler para ACTIVIDADES POR ASIGNATURA / CURSO
// ---------------------------

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

ipcMain.handle("actividades-de-curso", (event, cursoId: string) => {
  const stmt = db.prepare(`
    SELECT id, nombre, fecha, curso_id, asignatura_id, descripcion,
           estado, analisis_fecha, umbral_aplicado
    FROM actividades
    WHERE curso_id = ?
    ORDER BY date(fecha) ASC, nombre ASC
  `);

  const actividades = stmt.all(cursoId) as ActividadCruda[];

  return actividades.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    fecha: a.fecha,
    cursoId: a.curso_id,
    asignaturaId: a.asignatura_id,
    descripcion: a.descripcion ?? "",
    estado: a.estado ?? "borrador",
    analisisFecha: a.analisis_fecha ?? null,
    umbralAplicado: a.umbral_aplicado ?? null,
  }));
});


ipcMain.handle("guardar-actividad", (event, actividad) => {
  const stmt = db.prepare(`
    INSERT INTO actividades (id, nombre, fecha, curso_id, asignatura_id, descripcion)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    actividad.id,
    actividad.nombre,
    actividad.fecha,
    actividad.cursoId,
    actividad.asignaturaId,
    actividad.descripcion || null 
  )

  return { success: true }
})


// Obtener todos los RA de una asignatura
ipcMain.handle("obtener-ra-por-asignatura", (event, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT id, codigo, descripcion
    FROM ra
    WHERE asignatura_id = ?
    ORDER BY codigo
  `);
  return stmt.all(asignaturaId);
});

// Obtener todos los CE de un RA
ipcMain.handle("obtener-ce-por-ra", (event, raId: string) => {
  const stmt = db.prepare(`
    SELECT id, codigo, descripcion
    FROM ce
    WHERE ra_id = ?
    ORDER BY codigo
  `);
  return stmt.all(raId);
});

ipcMain.handle("analizar-descripcion", async (_e, actividadId: string) => {
  // tu función real:
  const resultado = await analizarDescripcionActividad(actividadId);
  return resultado; // debe devolver el array con {codigo, descripcion, puntuacion, ...}
});

// Extraemos textos planos extraidos desde un PDF
ipcMain.handle("analizar-descripcion-desde-texto", async (event, texto: string, asignaturaId: string) => {
  const resultado = await analizarTextoPlano(texto, asignaturaId); // función idéntica a `analizarDescripcionActividad` pero con texto plano
  return resultado;
});

ipcMain.handle("extraer-texto-pdf", async (event, filePath: string) => {
  return extraerTextoPDF(filePath);
});

const rutaPDFs = path.join(__dirname, "..", "data", "archivos_pdf");

if (!fs.existsSync(rutaPDFs)) {
  fs.mkdirSync(rutaPDFs, { recursive: true });
}

ipcMain.handle("guardar-pdf", async (event, buffer: ArrayBuffer, nombre: string) => {
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

ipcMain.handle("actividad.guardar-analisis", (_e, payload) => {
  const { actividadId, umbral, ces } = payload;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE actividades
      SET estado = 'analizada',
          umbral_aplicado = ?,
          analisis_fecha = ?
      WHERE id = ?
    `).run(umbral, now, actividadId);

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

    db.prepare(`
      INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha, meta)
      VALUES (?, ?, 'analizada', ?, ?)
    `).run(crypto.randomUUID(), actividadId, now, JSON.stringify({ umbral }));
  });

  tx();
  return { ok: true };
});

ipcMain.handle("actividad.leer-analisis", (_e, actividadId: string) => {
  const meta = db.prepare(`
    SELECT umbral_aplicado, analisis_fecha
    FROM actividades
    WHERE id = ?
  `).get(actividadId) as { umbral_aplicado: number|null; analisis_fecha: string|null } | undefined;

  const ces = db.prepare(`
    SELECT ce_codigo AS codigo, puntuacion, razon, evidencias
    FROM actividad_ce
    WHERE actividad_id = ? AND incluido = 1
    ORDER BY puntuacion DESC
  `).all(actividadId) as {
    codigo: string; puntuacion: number; razon?: string; evidencias?: string|null;
  }[];

  return {
    umbral: meta?.umbral_aplicado ?? 0,
    fecha: meta?.analisis_fecha ?? null,
    ces: ces.map(c => ({
      codigo: c.codigo,
      descripcion: "", // rellena si tienes descripción maestra
      puntuacion: c.puntuacion,
      reason: (c.razon as any) ?? undefined,
      evidencias: c.evidencias ? JSON.parse(c.evidencias) : undefined,
    })),
  };
});

// ---------------------------
// IPC handler: BORRAR ACTIVIDAD (con validación de estado)
// ---------------------------

// Transacción de borrado segura (borra dependencias si no usas FK con CASCADE)
const txBorrarActividad = db.transaction((id: string) => {
  // Si tienes claves foráneas con ON DELETE CASCADE hacia actividades.id,
  // podrías omitir estos dos deletes manuales.
  db.prepare(`DELETE FROM actividad_ce WHERE actividad_id = ?`).run(id);
  db.prepare(`DELETE FROM actividad_estado_historial WHERE actividad_id = ?`).run(id);

  const info = db.prepare(`DELETE FROM actividades WHERE id = ?`).run(id);
  if (info.changes === 0) throw new Error("NOT_FOUND");
});

ipcMain.handle("borrar-actividad", (_event, id: string) => {
  if (!id || typeof id !== "string") throw new Error("ID inválido");

  // Validar estado si existe la columna (ya tienes getEstadoActividad arriba)
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
