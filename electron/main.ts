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


ipcMain.handle("guardar-horario", (event, horario) => {
  const stmt = db.prepare(`
    INSERT INTO horarios (asignatura_id, dia, hora_inicio, hora_fin)
    VALUES (?, ?, ?, ?)
  `)

  stmt.run(horario.asignaturaId, horario.dia, horario.horaInicio, horario.horaFin)

  return { success: true }
})

ipcMain.handle("leer-horarios", (event, asignaturaId: string) => {
  const stmt = db.prepare(`
    SELECT dia, hora_inicio, hora_fin
    FROM horarios
    WHERE asignatura_id = ?
  `)

  const resultados = stmt.all(asignaturaId) as {
    dia: string
    hora_inicio: string
    hora_fin: string
  }[]

  return resultados.map((h) => ({
    dia: h.dia,
    horaInicio: h.hora_inicio,
    horaFin: h.hora_fin,
  }))
})

ipcMain.handle("borrar-horario", (event, datos: { asignaturaId: string; dia: string; horaInicio: string }) => {
  const stmt = db.prepare(`
    DELETE FROM horarios
    WHERE asignatura_id = ? AND dia = ? AND hora_inicio = ?
  `)

  stmt.run(datos.asignaturaId, datos.dia, datos.horaInicio)
  return { success: true }
})

// ---------------------------
// IPC handler para HORARIOS de FULLCALENDAR
// ---------------------------

ipcMain.handle("leer-horarios-todos", () => {
  const stmt = db.prepare(`
    SELECT h.dia, h.hora_inicio, h.hora_fin, a.nombre, asignatura_id
    FROM horarios h
    JOIN asignaturas a ON h.asignatura_id = a.id
  `);

  const resultados = stmt.all() as {
    dia: string;
    hora_inicio: string;
    hora_fin: string;
    nombre: string;
    asignatura_id: string;
  }[];

  return resultados.map((h) => ({
    title: `📘 ${h.nombre}`,
    start: generarFecha(h.dia, h.hora_inicio),
    end: generarFecha(h.dia, h.hora_fin),
    asignaturaId: h.asignatura_id,
  }));

  function generarFecha(dia: string, hora: string): string {
    const diasSemana: Record<string, number> = {
      lunes: 1,
      martes: 2,
      miercoles: 3,
      miércoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      sábado: 6,
      domingo: 0,
    };

    const base = new Date("2025-07-14"); // lunes como día de referencia
    const offset = diasSemana[dia.toLowerCase()] ?? 1;
    const fecha = new Date(base);
    fecha.setDate(base.getDate() + (offset - 1));

    const [hh, mm] = hora.split(":");
    fecha.setHours(Number(hh), Number(mm), 0, 0);

    return fecha.toISOString();
  }
});

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