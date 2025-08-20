// electron/cron.ts
import cron from "node-cron";
import Database from "better-sqlite3";
import { Notification, ipcMain, BrowserWindow } from "electron";
import { randomUUID } from "crypto";

// --- DB ---
const db = new Database("data/db.sqlite");

// Asegura el índice (rendimiento en consulta del cron)
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_actividades_estado_fecha
  ON actividades (estado, fecha)
`).run();

// ---- Tipos ----
type ActividadLite = { id: string; nombre: string; fecha: string };

// ---- transición atómica + historial ----
// Devuelve también ids afectadas para poder notificar al front
const transicionarProgramadasAPendiente = db.transaction(() => {
  const sel = db.prepare<[], ActividadLite>(`
    SELECT id, nombre, fecha
    FROM actividades
    WHERE estado = 'programada'
      AND DATE(fecha) < DATE('now','localtime')
  `);
  const toUpdate = sel.all(); // ActividadLite[]

  if (toUpdate.length === 0) return { count: 0, ids: [] as string[] };

  const upd = db.prepare<[string]>(`
    UPDATE actividades
    SET estado = 'pendiente_evaluar'
    WHERE id = ?
  `);

  const insHist = db.prepare<[string, string]>(`
    INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha)
    VALUES (?, ?, 'pendiente_evaluar', datetime('now','localtime'))
  `);

  for (const row of toUpdate) {
    upd.run(row.id);
    try {
      insHist.run(randomUUID(), row.id);
    } catch {
      /* ignora errores de duplicado */
    }
  }

  return { count: toUpdate.length, ids: toUpdate.map(r => r.id) };
});

// Expuesto para tests/IPC (devuelve sólo el count para no romper el front)
export const __runNow = () => {
  const res = transicionarProgramadasAPendiente();
  if (res.count > 0) {
    // emite evento al front cuando se fuerza manualmente
    BrowserWindow.getAllWindows().forEach(w =>
      w.webContents.send("actividades.actualizadas", { count: res.count })
    );
  }
  return res.count;
};

// ---- IPC: registrar UNA sola vez al cargar el módulo ----
ipcMain.removeHandler("cron.forzar-revision-estados");
ipcMain.handle("cron.forzar-revision-estados", () => __runNow());

// ---- Cron scheduler ----
let cronStarted = false; // evita múltiples schedules en hot-reload

export function inicializarCron(isPackaged: boolean) {
  if (cronStarted) return; // ya está corriendo
  cronStarted = true;

  const SCHEDULE_TEST = "*/1 * * * *"; // cada minuto (dev)
  const SCHEDULE_REAL = "5 0 * * *";   // 00:05 (prod)
  const ACTIVE_SCHEDULE = isPackaged ? SCHEDULE_REAL : SCHEDULE_TEST;

  cron.schedule(ACTIVE_SCHEDULE, () => {
    try {
      const res = transicionarProgramadasAPendiente();
      if (res.count > 0) {
        console.log(`[cron] ${res.count} actividades → pendiente_evaluar`);

        // Notifica escritorio (opcional)
        new Notification({
          title: "SkillForge",
          body: `${res.count} actividad(es) pasaron a “Pendiente de evaluar”`,
        }).show();

        // Emite evento al/los renderer(s) para refrescar UI
        BrowserWindow.getAllWindows().forEach(w =>
          w.webContents.send("actividades.actualizadas", { count: res.count })
        );
      }
    } catch (e) {
      console.error("[cron] Error en tarea:", e);
    }
  });

  console.log(`[cron] programado: ${ACTIVE_SCHEDULE} (${isPackaged ? "prod" : "dev"})`);
}
