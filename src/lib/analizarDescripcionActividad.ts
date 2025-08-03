import Database from "better-sqlite3";
import { compararCEconActividad } from "../../lib/comparadorCE";

const db = new Database("data/db.sqlite");

type ActividadDB = {
  descripcion: string;
  asignatura_id: string;
};

type CE = {
  codigo: string;
  descripcion: string;
};

type AsignaturaRow = {
  RA: any;
};

type ResultadoCE = {
  codigo: string;
  descripcion: string;
  puntuacion: number;
};

export async function analizarDescripcionActividad(
  actividadId: string
): Promise<ResultadoCE[]> {
  // 1. Obtener la actividad
  const actividad = db
    .prepare("SELECT descripcion, asignatura_id FROM actividades WHERE id = ?")
    .get(actividadId) as ActividadDB;

  if (!actividad) throw new Error("❌ Actividad no encontrada");

  // 2. Obtener los RA (con sus CE) de la asignatura
  const row = db
    .prepare("SELECT RA FROM asignaturas WHERE id = ?")
    .get(actividad.asignatura_id) as AsignaturaRow;

  if (!row?.RA) throw new Error("❌ RA no encontrados en asignatura");

  let raParsed: any[] = [];

  try {
    if (Buffer.isBuffer(row.RA)) {
      raParsed = JSON.parse(row.RA.toString("utf-8"));
    } else if (typeof row.RA === "string") {
      raParsed = JSON.parse(row.RA);
    } else {
      raParsed = row.RA;
    }
  } catch (err) {
    throw new Error("❌ Error al parsear los RA: " + err);
  }

  // 3. Extraer todos los CE
  const todosCE: CE[] = [];
  for (const ra of raParsed) {
    if (Array.isArray(ra.CE)) {
      for (const ce of ra.CE) {
        todosCE.push({
          codigo: ce.codigo,
          descripcion: ce.descripcion,
        });
      }
    }
  }

  // 4. Comparar cada CE con la descripción
  const resultado: ResultadoCE[] = [];

  for (const ce of todosCE) {
    const match = await compararCEconActividad(
      actividad.descripcion,
      ce.codigo,
      ce.descripcion
    );

    if (match) {
      resultado.push({
        codigo: ce.codigo,
        descripcion: ce.descripcion,
        puntuacion: match.puntuacion,
      });
    }
  }

  return resultado;
}
