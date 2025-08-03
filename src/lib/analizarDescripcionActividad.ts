import Database from "better-sqlite3";
import { analizarTexto } from "../../lib/agente";

const db = new Database("data/db.sqlite");

type ActividadDB = {
  descripcion: string;
  asignatura_id: string;
};

export async function analizarDescripcionActividad(
  actividadId: string
): Promise<string[]> {
  // 1. Obtener la actividad
  const actividad = db
    .prepare("SELECT descripcion, asignatura_id FROM actividades WHERE id = ?")
    .get(actividadId) as ActividadDB;

  if (!actividad) throw new Error("❌ Actividad no encontrada");

  // 2. Obtener la asignatura asociada
  const fila = db
    .prepare("SELECT * FROM asignaturas WHERE id = ?")
    .get(actividad.asignatura_id);

  if (!fila) throw new Error("❌ No se encontró la asignatura");

  // 3. Buscar el campo RA
  const claveRA = Object.keys(fila).find((k) => k.toLowerCase() === "ra");
  if (!claveRA) throw new Error("❌ Campo RA no encontrado");

  const raRaw = fila[claveRA as keyof typeof fila];
  let raString: string;

  if (Buffer.isBuffer(raRaw)) {
    raString = (raRaw as Buffer).toString("utf-8");
  } else if (typeof raRaw === "object") {
    raString = JSON.stringify(raRaw);
  } else {
    raString = String(raRaw);
  }

  // 4. Parsear RA
  let raParsed;
  try {
    raParsed = JSON.parse(raString.trim());
  } catch (err) {
    console.error("❌ RA mal formateado:", raString);
    throw new Error("❌ RA no es un JSON válido");
  }

  // 5. Extraer CE
  type CEItem = { codigo: string; descripcion: string };
  type RAItem = { codigo: string; descripcion: string; CE?: CEItem[] };

  const listaCE: string[] = [];

  for (const ra of raParsed as RAItem[]) {
    const ceList = ra.CE ?? [];
    for (const ce of ceList) {
      listaCE.push(`${ce.codigo} — ${ce.descripcion}`);
    }
  }

  // 6. Prompt mejorado
  const prompt = `
Eres un experto evaluador en Formación Profesional.

Se te proporciona una actividad didáctica y una lista de Criterios de Evaluación (CE) asociados a una asignatura. 

Tu tarea es analizar el contenido de la actividad y determinar con precisión cuáles de esos CE están siendo evaluados de forma explícita o implícita. 

✔️ Solo incluye los CE que estén justificados por el contenido de la actividad.  
❌ No incluyas CE que no estén claramente representados.  
💡 Si no hay CE relevantes, responde con una lista vacía.

---

ACTIVIDAD:
"""
${actividad.descripcion}
"""

CRITERIOS DE EVALUACIÓN:
${listaCE.join("\n")}

RESPUESTA ESPERADA (solo JSON):
["CE1.2", "CE2.1", "CE3.4"]
  `.trim();

  // 7. Enviar al agente
  const resultadoIA = await analizarTexto(prompt);

  const codigosDetectados = resultadoIA.filter((codigo) =>
  listaCE.some((linea) => linea.startsWith(codigo))
);

  return codigosDetectados;
}
