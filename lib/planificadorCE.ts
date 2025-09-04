// lib/planificadorCE.ts
// Planificador de CE: dificultad + orden óptimo + ajuste a sesiones + evaluaciones RA.
// Determinista; usa heurística y (opcional) LLM para puntuar dificultad y minutos.

import { llmJson } from "./llm";

/* =========================
 * Tipos base (ALGORITMO)
 * ========================= */
export type CE = {
  id: string;
  codigo: string;        // ej. "CE3.2"
  descripcion: string;
  raCodigo: string;      // ej. "RA3"
};

export type Sesion = {
  id: string;
  fechaISO?: string;
  minutos: number;
};

export type CEEvaluado = {
  ceId: string;
  dificultad: number;            // 1-5
  minutosSugeridos: number;      // múltiplos de 5 (20..120)
  prereqs: string[];             // por CÓDIGO (normalmente del mismo RA)
  justificacion: string;
};

export type ItemPlan = {
  sesionId: string;
  tipo: "CE" | "EVALUACION_RA";
  ceId?: string;
  raCodigo?: string;
  minutosOcupados: number;
};

export type Plan = {
  items: ItemPlan[];
  cesNoUbicados: string[];
  metaCE: Record<string, { dificultad: number; minutos: number }>;
};

/* =========================
 * Heurística determinista
 * ========================= */
function heuristicaCE(ce: CE): CEEvaluado {
  const t = ce.descripcion.toLowerCase();

  const D1 = ["enumerar", "listar"];
  const D2 = ["identificar", "definir", "describir", "reconocer", "clasificar", "nombrar"];
  const D3 = ["relacionar", "comparar", "analizar", "seleccionar", "valorar", "utilizar", "usar"];
  const D4 = ["aplicar", "configurar", "modificar", "integrar", "elaborar", "programar", "ajustar"];
  const D5 = ["diseñar", "desarrollar", "implementar", "optimizar", "evaluar", "construir", "prototipar", "crear"];

  const hit = (arr: string[]) => arr.some(v => t.includes(v));

  let base = 2;
  if (hit(D1)) base = 1;
  else if (hit(D2)) base = 2;
  else if (hit(D3)) base = 3;
  else if (hit(D4)) base = 4;
  else if (hit(D5)) base = 5;

  const len = ce.descripcion.split(/\s+/).length;
  if (len > 25) base += 0.25;
  if (len > 45) base += 0.25;

  const dificultad = Math.min(5, Math.max(1, Math.round(base)));
  const mapa: Record<number, number> = { 1: 20, 2: 25, 3: 40, 4: 55, 5: 70 };
  const minutosSugeridos = mapa[dificultad] ?? 35;

  return {
    ceId: ce.id,
    dificultad,
    minutosSugeridos,
    prereqs: [],
    justificacion: "Heurística por verbo/longitud.",
  };
}

/* =========================
 * Scoring con LLM (opcional)
 * ========================= */
async function evaluarConLLM(ces: CE[]): Promise<CEEvaluado[]> {
  type Out = { items: CEEvaluado[] };

  const system = `Eres un evaluador pedagógico. Devuelves SOLO JSON válido.
Puntúa DIFICULTAD 1..5 (5=más complejo) considerando Bloom, pasos implícitos y dependencias.
Sugiere "minutosSugeridos" en múltiplos de 5 (20..120) pensando en sesiones de 55':
- Guía: D1≈20, D2≈25, D3≈40, D4≈55, D5≈70.
Indica prerequisitos por CÓDIGO cuando proceda. No inventes CE.`;

  const user = JSON.stringify({
    ces: ces.map(c => ({ id: c.id, codigo: c.codigo, raCodigo: c.raCodigo, descripcion: c.descripcion })),
  });

  const out = await llmJson<Out>(system, user, { seed: 4242 });
  return out.items.map(x => ({
    ...x,
    dificultad: Math.min(5, Math.max(1, Math.round(x.dificultad))),
    minutosSugeridos: Math.min(120, Math.max(20, Math.round((x.minutosSugeridos ?? 35) / 5) * 5)),
    prereqs: (x.prereqs ?? []).filter(Boolean),
  }));
}

/* =========================
 * Utilidades
 * ========================= */
function agruparPorRA(ces: CE[]) {
  const map = new Map<string, CE[]>();
  for (const ce of ces) {
    const arr = map.get(ce.raCodigo) ?? [];
    arr.push(ce);
    map.set(ce.raCodigo, arr);
  }
  return map;
}

function capacidadRestante(sesion: Sesion, ocupados: number) {
  return Math.max(0, sesion.minutos - ocupados);
}

function siguienteSesionLibre(ix: number, sesiones: Sesion[], ocupados: number[]): number | null {
  for (let i = ix; i < sesiones.length; i++) {
    if (capacidadRestante(sesiones[i], ocupados[i]) >= 15) return i;
  }
  return null;
}

/* =========================
 * Planificador principal
 * ========================= */
export type PlanificarOpts = {
  usarLLM?: boolean;
  insertarEvaluacionRA?: boolean;
  resolverFaltaHueco?: "ninguno" | "recortar";
  estrategia?: "intercalado-estricto" | "rampa-mixta" | "por-ra";
  maxCEporSesion?: number;
};

export async function planificarCEs(
  ces: CE[],
  sesiones: Sesion[],
  opts: PlanificarOpts = {
    usarLLM: true,
    insertarEvaluacionRA: true,
    resolverFaltaHueco: "recortar",
    estrategia: "intercalado-estricto",
    maxCEporSesion: 3,
  }
): Promise<Plan> {
  if (!ces.length || !sesiones.length) {
    return { items: [], cesNoUbicados: ces.map(c => c.id), metaCE: {} };
  }

  // 1) Dificultad + minutos
  let evals: CEEvaluado[] = [];
  if (opts.usarLLM) {
    try { evals = await evaluarConLLM(ces); } catch { evals = ces.map(heuristicaCE); }
  } else {
    evals = ces.map(heuristicaCE);
  }
  const evalById = new Map(evals.map(e => [e.ceId, e]));
  const metaCE: Record<string, { dificultad: number; minutos: number }> = {};
  for (const e of evals) metaCE[e.ceId] = { dificultad: e.dificultad, minutos: e.minutosSugeridos };

  // 2) Prereqs inferidos por RA si faltan (D>=4)
  const porRA = agruparPorRA(ces);
  for (const [, lista] of porRA) {
    const orden = [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));
    for (let i = 1; i < orden.length; i++) {
      const c = orden[i];
      const e = evalById.get(c.id)!;
      if (e.prereqs.length === 0 && e.dificultad >= 4) e.prereqs.push(orden[i - 1].codigo);
    }
  }

  // 3) Nodos + prereqs por id
  type Nodo = CE & { diff: number; mins: number; prereqCodes: Set<string> };
  const nodos: Nodo[] = ces.map(c => {
    const e = evalById.get(c.id)!;
    return { ...c, diff: e.dificultad, mins: e.minutosSugeridos, prereqCodes: new Set(e.prereqs) };
  });

  const codigoToId = new Map<string, string>();
  for (const c of ces) codigoToId.set(c.codigo, c.id);

  const prereqIds = new Map<string, Set<string>>();
  for (const n of nodos) {
    const set = new Set<string>();
    for (const cod of n.prereqCodes) {
      const id = codigoToId.get(cod);
      if (id) set.add(id);
    }
    prereqIds.set(n.id, set);
  }

  function cumplePrereqs(n: Nodo, ya: Set<string>) {
    const req = prereqIds.get(n.id) ?? new Set<string>();
    for (const r of req) if (!ya.has(r)) return false;
    return true;
  }

  // --------- ORDEN GLOBAL ----------
  let linea: Nodo[] = [];
  if (opts.estrategia === "por-ra") {
    for (const [, lista] of porRA) {
      const ord = [...lista]
        .map(c => nodos.find(n => n.id === c.id)!)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es") || a.diff - b.diff);
      linea.push(...ord);
    }
  } else if (opts.estrategia === "rampa-mixta") {
    linea = [...nodos].sort((a, b) => a.diff - b.diff || a.codigo.localeCompare(b.codigo, "es"));
  } else {
    // intercalado-estricto: round-robin por RA respetando prereqs
    const colas = new Map<string, Nodo[]>();
    for (const [ra, lista] of porRA) {
      const ord = [...lista]
        .map(c => nodos.find(n => n.id === c.id)!)
        .sort((a, b) => a.diff - b.diff || a.codigo.localeCompare(b.codigo, "es"));
      colas.set(ra, ord);
    }
    const ras = Array.from(colas.keys()).sort();
    const ya = new Set<string>();
    while (true) {
      let pushed = false;
      for (const ra of ras) {
        const q = colas.get(ra)!;
        while (q.length && !cumplePrereqs(q[0], ya)) {
          q.push(q.shift()!);
          if (q.every(n => !cumplePrereqs(n, ya))) break;
        }
        if (q.length && cumplePrereqs(q[0], ya)) {
          const n = q.shift()!;
          linea.push(n);
          ya.add(n.id);
          pushed = true;
        }
      }
      if (!pushed) break;
      if (colas.size && Array.from(colas.values()).every(v => v.length === 0)) break;
    }
    for (const [, q] of colas) linea.push(...q); // fallback
  }

  // --------- EMPAQUETADO EN SESIONES ----------
  function empaquetar(secs: Sesion[], orden: Nodo[]) {
    const items: ItemPlan[] = [];
    const ocupados = new Array(secs.length).fill(0);
    const colocados = new Set<string>();

    let idxSesion = 0;
    const cupo = Math.max(1, opts.maxCEporSesion ?? 3);

    for (const n of orden) {
      const start = siguienteSesionLibre(idxSesion, secs, ocupados);
      if (start === null) break;
      idxSesion = start;

      let puesto = false;
      let intentos = 0;

      for (let i = start; i < secs.length && intentos < secs.length; i++, intentos++) {
        const enEsa = items.filter(it => it.sesionId === secs[i].id && it.tipo === "CE").length;
        const libre = capacidadRestante(secs[i], ocupados[i]);
        if (enEsa < cupo && n.mins <= libre) {
          items.push({ sesionId: secs[i].id, tipo: "CE", ceId: n.id, minutosOcupados: n.mins });
          ocupados[i] += n.mins;
          colocados.add(n.id);
          puesto = true;
          break;
        }
      }
      if (!puesto) break;
    }
    return { items, ocupados, colocados };
  }

  // 1er pase
  let { items, ocupados, colocados } = empaquetar(sesiones, linea);

  // CE pendientes
  let pendientes = linea.filter(n => !colocados.has(n.id)).map(n => n.id);

  // --------- COMPACTACIÓN (recortar minutos si falta hueco) ----------
  if (pendientes.length > 0 && opts.resolverFaltaHueco === "recortar") {
    const capLibre = sesiones.reduce((acc, s, i) => acc + Math.max(0, s.minutos - ocupados[i]), 0);
    const demanda = pendientes.map(id => evalById.get(id)!.minutosSugeridos).reduce((a, b) => a + b, 0);

    if (capLibre > 0) {
      const factor = Math.max(0.25, Math.min(1, capLibre / demanda));
      for (const id of pendientes) {
        const e = evalById.get(id)!;
        const recorte = Math.max(15, Math.round((e.minutosSugeridos * factor) / 5) * 5);
        e.minutosSugeridos = recorte;
        metaCE[id].minutos = recorte;
      }
      const nodosRe = linea.map(n => ({ ...n, mins: evalById.get(n.id)!.minutosSugeridos }));
      const re = empaquetar(sesiones, nodosRe);
      items = re.items; ocupados = re.ocupados; colocados = re.colocados;
      pendientes = linea.filter(n => !colocados.has(n.id)).map(n => n.id);
    }
  }

  // --- helpers de reflow (NO mover CE de RAs evaluadas ni de la RA actual) ---
  function contarCEenSesion(items: ItemPlan[], sesionId: string) {
    return items.filter(it => it.sesionId === sesionId && it.tipo === "CE").length;
  }
  function moverCEaPosteriorSiCabe_BloqueandoRAs(
    ce: ItemPlan, fromIdx: number, bloqueadas: Set<string>,
    sesiones: Sesion[], itemsTmp: ItemPlan[], ocupadosTmp: number[],
    cupo: number, ceIdToRA: Map<string, string>
  ): boolean {
    if (ce.tipo !== "CE" || !ce.ceId) return false;
    const raCE = ceIdToRA.get(ce.ceId);
    if (raCE && bloqueadas.has(raCE)) return false;
    for (let j = fromIdx + 1; j < sesiones.length; j++) {
      const sesId = sesiones[j].id;
      const libre = Math.max(0, sesiones[j].minutos - ocupadosTmp[j]);
      const ceCount = contarCEenSesion(itemsTmp, sesId);
      if (ceCount < cupo && libre >= (ce.minutosOcupados || 0)) {
        ocupadosTmp[fromIdx] -= (ce.minutosOcupados || 0);
        ocupadosTmp[j]       += (ce.minutosOcupados || 0);
        ce.sesionId = sesId;
        return true;
      }
    }
    return false;
  }
  function intentarLiberarHuecoConReflow_BloqueandoRAs(
    idx: number, minutos: number, bloqueadas: Set<string>,
    sesiones: Sesion[], items: ItemPlan[], ocupados: number[],
    cupo: number, ceIdToRA: Map<string,string>
  ): { items: ItemPlan[]; ocupados: number[] } | null {
    const itemsTmp = items.map(it => ({ ...it }));
    const ocupadosTmp = [...ocupados];
    const sesId = sesiones[idx].id;
    const libreInicial = Math.max(0, sesiones[idx].minutos - ocupadosTmp[idx]);
    if (libreInicial >= minutos) return { items: itemsTmp, ocupados: ocupadosTmp };
    let faltan = minutos - libreInicial;
    const cesEnSesion = itemsTmp
      .filter(it => it.sesionId === sesId && it.tipo === "CE")
      .sort((a, b) => (b.minutosOcupados || 0) - (a.minutosOcupados || 0));
    for (const ce of cesEnSesion) {
      const moved = moverCEaPosteriorSiCabe_BloqueandoRAs(
        ce, idx, bloqueadas, sesiones, itemsTmp, ocupadosTmp, cupo, ceIdToRA
      );
      if (moved) {
        faltan -= (ce.minutosOcupados || 0);
        if (faltan <= 0) return { items: itemsTmp, ocupados: ocupadosTmp };
      }
    }
    return null;
  }

  // --------- Insertar Evaluaciones RA (siempre después del ÚLTIMO CE) ----------
  if (opts.insertarEvaluacionRA) {
    const sesIndex = new Map<string, number>(sesiones.map((s, i) => [s.id, i]));
    const ceIdToRA = new Map<string, string>(nodos.map(n => [n.id, n.raCodigo]));
    const cupo = Math.max(1, opts.maxCEporSesion ?? 3);
    const metas = [30, 20, 15];

    const calcLastIdxByRA = () => {
      const map = new Map<string, number>();
      for (const it of items) {
        if (it.tipo !== "CE" || !it.ceId) continue;
        const ra = ceIdToRA.get(it.ceId)!;
        const ix = sesIndex.get(it.sesionId)!;
        map.set(ra, Math.max(map.get(ra) ?? -1, ix));
      }
      return map;
    };

    const evaluadas = new Set<string>();

    while (true) {
      const lastIdx = calcLastIdxByRA();
      const pendientesEval = Array.from(lastIdx.keys()).filter(ra => !evaluadas.has(ra));
      if (pendientesEval.length === 0) break;

      pendientesEval.sort((a, b) => (lastIdx.get(a)! - lastIdx.get(b)!));
      const ra = pendientesEval[0];
      const lastIx = lastIdx.get(ra)!;
      const preferida = lastIx + 1;

      const candidatos: number[] = [];
      if (preferida < sesiones.length) candidatos.push(preferida);
      for (let j = preferida + 1; j < sesiones.length; j++) candidatos.push(j);
      const ultRec = candidatos.length === 0 ? [lastIx] : [];

      let puesta = false;
      const bloqueadas = new Set<string>([ra, ...evaluadas]);

      for (const minutos of metas) {
        if (puesta) break;

        for (const idx of candidatos) {
          if (capacidadRestante(sesiones[idx], ocupados[idx]) >= minutos) {
            items.push({ sesionId: sesiones[idx].id, tipo: "EVALUACION_RA", raCodigo: ra, minutosOcupados: minutos });
            ocupados[idx] += minutos; puesta = true; break;
          }
          if (idx === preferida) {
            const liberado = intentarLiberarHuecoConReflow_BloqueandoRAs(
              idx, minutos, bloqueadas, sesiones, items, ocupados, cupo, ceIdToRA
            );
            if (liberado) {
              items = liberado.items; ocupados = liberado.ocupados;
              items.push({ sesionId: sesiones[idx].id, tipo: "EVALUACION_RA", raCodigo: ra, minutosOcupados: minutos });
              ocupados[idx] += minutos; puesta = true; break;
            }
          }
        }
        if (puesta) break;

        for (const idx of ultRec) {
          if (capacidadRestante(sesiones[idx], ocupados[idx]) >= minutos) {
            items.push({ sesionId: sesiones[idx].id, tipo: "EVALUACION_RA", raCodigo: ra, minutosOcupados: minutos });
            ocupados[idx] += minutos; puesta = true; break;
          }
          const liberado = intentarLiberarHuecoConReflow_BloqueandoRAs(
            idx, minutos, bloqueadas, sesiones, items, ocupados, cupo, ceIdToRA
          );
          if (liberado) {
            items = liberado.items; ocupados = liberado.ocupados;
            items.push({ sesionId: sesiones[idx].id, tipo: "EVALUACION_RA", raCodigo: ra, minutosOcupados: minutos });
            ocupados[idx] += minutos; puesta = true; break;
          }
        }
      }
      evaluadas.add(ra);
    }
  }

  const cesNoUbicados = linea
    .filter(n => !items.some(it => it.tipo === "CE" && it.ceId === n.id))
    .map(n => n.id);

  return { items, cesNoUbicados, metaCE };
}

/* =========================
 * Ejemplo de uso (opcional)
 * ========================= */
export async function generarPlanEjemplo() {
  const ces: CE[] = [
    { id: "1", codigo: "CE1.1", raCodigo: "RA1", descripcion: "Identificar tecnologías habilitadoras digitales." },
    { id: "2", codigo: "CE1.2", raCodigo: "RA1", descripcion: "Analizar la importancia de la conexión IT/OT." },
    { id: "3", codigo: "CE3.4", raCodigo: "RA3", descripcion: "Crear componentes visuales reutilizables." },
  ];

  const sesiones: Sesion[] = [
    { id: "S1", fechaISO: "2025-09-23T08:00:00.000Z", minutos: 55 },
    { id: "S2", fechaISO: "2025-09-30T08:00:00.000Z", minutos: 55 },
  ];

  const plan = await planificarCEs(ces, sesiones, {
    usarLLM: true,
    estrategia: "intercalado-estricto",
    maxCEporSesion: 3,
    resolverFaltaHueco: "recortar",
  });
  return plan;
}
