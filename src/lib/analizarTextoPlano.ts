import Database from "better-sqlite3";
import { compararCEconActividad } from "../../lib/comparadorCE";

const db = new Database("data/db.sqlite");

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

export async function analizarTextoPlano(
  textoPlano: string,
  asignaturaId: string
): Promise<ResultadoCE[]> {
  // 1. Obtener los RA (con sus CE) de la asignatura
  const row = db
    .prepare("SELECT RA FROM asignaturas WHERE id = ?")
    .get(asignaturaId) as AsignaturaRow;

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

  // 2. Extraer todos los CE
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

  // 3. Comparar cada CE con el texto plano
  const resultado: ResultadoCE[] = [];

  for (const ce of todosCE) {
    const match = await compararCEconActividad(textoPlano, ce.codigo, ce.descripcion);

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
