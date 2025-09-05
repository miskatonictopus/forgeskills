// lib/evaluadorDificultadLLM.ts
import crypto from "crypto";
import { llmJson } from "./llm";

export type CE = {
  id: string;
  codigo: string;
  descripcion: string;
  raCodigo: string;
};

export type CEEvaluado = {
  ceId: string;
  dificultad: number;       // 1..5
  minutosSugeridos: number; // 20..120 (múltiplos de 5)
  prereqs: string[];        // por CÓDIGO
  justificacion: string;
};

type RawItem = {
  ceId: string;
  dificultad: number;
  minutosSugeridos: number;
  prereqs?: string[];
  justificacion: string;
};

type Out = { items: RawItem[] };

const cache = new Map<string, CEEvaluado[]>();

function hashCEs(ces: CE[]) {
  const h = crypto.createHash("sha256");
  for (const c of ces) h.update(`${c.id}|${c.codigo}|${c.raCodigo}|${c.descripcion}||`);
  return h.digest("hex");
}

function clampMinutes(v: number) {
  const m = Math.min(120, Math.max(20, Math.round(v / 5) * 5));
  return m;
}

function clampDiff(d: number) {
  return Math.min(5, Math.max(1, Math.round(d)));
}

// Garantiza algo de dispersión si todo cae en el mismo nivel
function diversificar(items: CEEvaluado[]): CEEvaluado[] {
  const counts = new Map<number, number>();
  for (const it of items) counts.set(it.dificultad, (counts.get(it.dificultad) ?? 0) + 1);

  // Si un único nivel concentra >60%, empujamos parte hacia vecinos según longitud/verbos
  const total = items.length;
  let maxLevel = 0, maxCount = 0;
  for (const [lvl, cnt] of counts) if (cnt > maxCount) { maxCount = cnt; maxLevel = lvl; }
  if (total >= 6 && maxCount / total > 0.6) {
    // mover ~⅓ de ese grupo a niveles vecinos
    const mover = Math.max(1, Math.floor(maxCount / 3));
    let moved = 0;
    for (const it of items) {
      if (moved >= mover) break;
      if (it.dificultad === maxLevel) {
        const up = Math.min(5, maxLevel + 1);
        const down = Math.max(1, maxLevel - 1);
        // regla simple: si minutos sugeridos > media, sube; si < media, baja
        const media = items.reduce((a, b) => a + b.minutosSugeridos, 0) / items.length;
        it.dificultad = clampDiff(it.minutosSugeridos >= media ? up : down);
        // re-ajusta minutos aproximando al mapa (ver guía)
        const mapa: Record<number, number> = { 1: 20, 2: 25, 3: 40, 4: 55, 5: 70 };
        it.minutosSugeridos = clampMinutes(mapa[it.dificultad] ?? it.minutosSugeridos);
        moved++;
      }
    }
  }
  return items;
}

export async function evaluarDificultadLLM(ces: CE[]): Promise<CEEvaluado[]> {
  if (!ces.length) return [];

  // caché
  const key = hashCEs(ces);
  const cached = cache.get(key);
  if (cached) return cached;

  // PASO 1: ANALISTA
  const systemAnalista = `Eres un analista pedagógico experto. Devuelves SOLO JSON válido.
Examina cada CE y estima su nivel de dificultad (1..5) con esta RÚBRICA:
- 1 (Recordar/Entender): reconocimiento, definiciones, listar sin inferencias.
- 2 (Entender/Aplicar básico): identificar, describir, relaciones simples, ejemplos directos.
- 3 (Aplicar/Analizar): aplicar en contextos nuevos cercanos, analizar componentes, comparar opciones.
- 4 (Analizar/Evaluar): tomar decisiones justificadas, integrar varias fuentes, cadena de pasos no trivial, condicionantes/criterios.
- 5 (Crear/Evaluar alto): diseño/implementación completa, optimización, generalización/transferencia a contextos distintos, autonomía alta.

Dimensiones a ponderar (explica en justificación):
- Pasos implícitos y encadenamiento.
- Transferencia a contextos nuevos.
- Autonomía requerida.
- Complejidad del dominio/recursos previos.

Propón "minutosSugeridos" (múltiplos de 5, 20..120) para sesiones de 55'.
Guía orientativa: D1≈20, D2≈25, D3≈40, D4≈55, D5≈70.
Incluye "prereqs" por CÓDIGO si procede (no inventes CEs).
`;

  const userAnalista = JSON.stringify({
    ces: ces.map(c => ({
      ceId: c.id,
      codigo: c.codigo,
      raCodigo: c.raCodigo,
      descripcion: c.descripcion,
    })),
  });

  const prelim = await llmJson<Out>(systemAnalista, userAnalista, { seed: 4242 });

  // PASO 2: JUEZ (consistencia + dispersión)
  const systemJuez = `Eres un revisor pedagógico. Devuelves SOLO JSON válido.
Revisa los puntajes y justificaciones. Corrige sesgos de colapso (evitar que todo sea D2/D3).
Asegura diversidad real si el contenido lo permite. Mantén prerequisitos si son razonables.
Respeta los rangos (dificultad 1..5, minutos múltiplos de 5 entre 20..120).`;

  const userJuez = JSON.stringify({ items: prelim.items });

  const veredicto = await llmJson<Out>(systemJuez, userJuez, { seed: 4242 });

  // Normalización estricta + diversificación defensiva
  let items: CEEvaluado[] = (veredicto.items ?? []).map((x) => ({
    ceId: x.ceId,
    dificultad: clampDiff(x.dificultad),
    minutosSugeridos: clampMinutes(x.minutosSugeridos ?? 35),
    prereqs: (x.prereqs ?? []).filter(Boolean),
    justificacion: x.justificacion?.trim() || "Evaluación LLM con rúbrica.",
  }));

  items = diversificar(items);

  cache.set(key, items);
  return items;
}
