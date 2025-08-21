// electron/cron.ts
import cron from "node-cron";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { Notification, ipcMain, BrowserWindow } from "electron";
import { randomUUID } from "crypto";

// ---- Tipos ----
type ActividadLite = { id: string; nombre: string; programada_para: string | null };

// Guard para no registrar dos veces en hot-reload
let cronStarted = false;

export function inicializarCron(db: BetterSqlite3Database, isPackaged: boolean) {
  if (cronStarted) return;
  cronStarted = true;

  // Índice correcto para esta consulta
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_actividades_estado_programada
    ON actividades (estado, programada_para)
  `).run();

  // ---- transición atómica + historial ----
  // Usamos date(programada_para) porque guardas 'YYYY-MM-DD'
  const transicionarProgramadasAPendiente = db.transaction(() => {
    const sel = db.prepare<[], ActividadLite>(`
      SELECT id, nombre, programada_para
      FROM actividades
      WHERE estado = 'programada'
        AND COALESCE(programada_para, '') <> ''
        AND DATE(programada_para) <= DATE('now')   -- 👈 clave
    `);

    const toUpdate = sel.all();
    if (toUpdate.length === 0) return { count: 0, ids: [] as string[] };

    const upd = db.prepare<[string]>(`
      UPDATE actividades
         SET estado = 'pendiente_evaluar'
       WHERE id = ?
    `);

    const insHist = db.prepare<[string, string]>(`
      INSERT INTO actividad_estado_historial (id, actividad_id, estado, fecha)
      VALUES (?, ?, 'pendiente_evaluar', datetime('now'))
    `);

    for (const row of toUpdate) {
      upd.run(row.id);
      try { insHist.run(randomUUID(), row.id); } catch { /* ignora duplicados */ }
    }

    return { count: toUpdate.length, ids: toUpdate.map(r => r.id) };
  });

  // Expuesto para tests/IPC (usa la misma closure de db)
  ipcMain.removeHandler("cron.forzar-revision-estados");
  ipcMain.handle("cron.forzar-revision-estados", () => {
    const res = transicionarProgramadasAPendiente();
    if (res.count > 0) {
      BrowserWindow.getAllWindows().forEach(w =>
        w.webContents.send("actividades.actualizadas", { count: res.count })
      );
    }
    return res.count;
  });

  const SCHEDULE_TEST = "*/1 * * * *"; // cada minuto en dev
  const SCHEDULE_REAL = "5 0 * * *";   // 00:05 en prod
  const ACTIVE_SCHEDULE = isPackaged ? SCHEDULE_REAL : SCHEDULE_TEST;

  const tick = () => {
    try {
      const res = transicionarProgramadasAPendiente();
      if (res.count > 0) {
        console.log(`[cron] ${res.count} actividades → pendiente_evaluar :: ${res.ids.join(", ")}`);
        new Notification({
          title: "SkillForge",
          body: `${res.count} actividad(es) pasaron a “Pendiente de evaluar”`,
        }).show();
        BrowserWindow.getAllWindows().forEach(w =>
          w.webContents.send("actividades.actualizadas", { count: res.count })
        );
      } else {
        console.log("[cron] sin cambios");
      }
    } catch (e) {
      console.error("[cron] Error en tarea:", e);
    }
  };

  // Programa y ejecuta una pasada inmediata
  cron.schedule(ACTIVE_SCHEDULE, tick);
  console.log(`[cron] programado: ${ACTIVE_SCHEDULE} (${isPackaged ? "prod" : "dev"})`);
  setTimeout(tick, 1500);
}
