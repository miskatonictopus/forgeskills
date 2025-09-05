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
  metaCE: Record<string, { dificultad: number; minutos: number; justificacion?: string }>;
};

/* =========================
 * Utilidades comunes
 * ========================= */
const clamp5 = (n: number) => Math.round(n / 5) * 5;
const clampMinutos = (n: number) => Math.min(120, Math.max(20, clamp5(n)));

function capacidadRestante(sesion: Sesion, ocupados: number) {
  return Math.max(0, sesion.minutos - ocupados);
}

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
  if (!ces.length) return [];

  type RawItem = {
    ceId?: string;
    codigo?: string;
    subscores?: {
      pasos: number;         // 1..5
      transferencia: number; // 1..5
      autonomia: number;     // 1..5
      complejidad: number;   // 1..5
    };
    minutos?: number;        // sugerencia libre
    prereqs?: string[];
    nota?: string;           // explicación breve
  };
  type Out = { items: RawItem[] };

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const round5 = (v: number) => Math.round(v / 5) * 5;
  const mapaMin: Record<number, number> = { 1: 20, 2: 25, 3: 40, 4: 55, 5: 70 };

  // ===== 1) LLM: pide SUB-SCORES (analista) =====
  const system = `Eres un analista pedagógico. Devuelves SOLO JSON válido con:
{
  "items":[
    {
      "ceId": "<id recibido>",
      "subscores": {
        "pasos": 1..5,
        "transferencia": 1..5,
        "autonomia": 1..5,
        "complejidad": 1..5
      },
      "minutos": 20..120,
      "prereqs": ["CE?.?"],
      "nota": "justificación breve"
    }
  ]
}
NO inventes CEs.`;
  const user = JSON.stringify({
    ces: ces.map((c) => ({
      ceId: c.id,
      codigo: c.codigo,
      raCodigo: c.raCodigo,
      descripcion: c.descripcion,
    })),
  });

  let out: Out;
  try {
    out = await llmJson<Out>(system, user, { seed: 4242 });
  } catch {
    return ces.map(heuristicaCE);
  }

  const byCodigo = new Map(ces.map((c) => [c.codigo, c.id]));

  // ===== 2) Construye score continuo + mezcla con heurística =====
  type Tmp = {
    id: string;
    rawScore: number;   // continuo 1..5 desde subscores
    heur: number;       // desde heurística
    blend: number;      // mezcla
    minutosPropuestos: number | undefined;
    prereqs: string[];
    nota: string;
  };

  const tmp: Tmp[] = ces.map((c) => {
    const ri =
      out.items.find((x) => x.ceId === c.id) ||
      out.items.find((x) => x.codigo && byCodigo.get(x.codigo) === c.id);

    const subs = ri?.subscores;
    const raw =
      subs
        ? (subs.pasos + subs.transferencia + subs.autonomia + subs.complejidad) / 4
        : undefined;

    const heur = heuristicaCE(c).dificultad;

    // Mezcla: 60% LLM, 40% heurística. Nunca por debajo de la heurística.
    let blend = raw ? 0.6 * raw + 0.4 * heur : heur;
    blend = Math.max(blend, heur);

    return {
      id: c.id,
      rawScore: clamp(raw ?? heur, 1, 5),
      heur,
      blend: clamp(blend, 1, 5),
      minutosPropuestos: ri?.minutos,
      prereqs: Array.isArray(ri?.prereqs) ? ri!.prereqs!.filter(Boolean) : [],
      nota: ri?.nota || "LLM + heurística",
    };
  });

  // ===== 3) Detecta colapso y expande por cuantiles si hace falta =====
  const mean = tmp.reduce((a, b) => a + b.blend, 0) / (tmp.length || 1);
  const variance = tmp.reduce((a, b) => a + Math.pow(b.blend - mean, 2), 0) / (tmp.length || 1);
  const std = Math.sqrt(variance);

  const hist = new Map<number, number>();
  for (const t of tmp) {
    const lvl = Math.round(t.blend);
    hist.set(lvl, (hist.get(lvl) ?? 0) + 1);
  }
  const total = tmp.length;
  let maxCount = 0;
  for (const [, cnt] of hist) maxCount = Math.max(maxCount, cnt);
  const colapso = std < 0.4 || maxCount / total > 0.7;

  if (colapso) {
    const sorted = [...tmp].sort((a, b) => a.blend - b.blend);
    const n = sorted.length;
    const q = (i: number) => (i + 0.5) / n;
    for (let i = 0; i < n; i++) {
      const qi = q(i);
      let lvl = 3;
      if (qi <= 0.12) lvl = 1;
      else if (qi <= 0.35) lvl = 2;
      else if (qi <= 0.70) lvl = 3;
      else if (qi <= 0.88) lvl = 4;
      else lvl = 5;
      sorted[i].blend = lvl;
    }
  }

  // ===== 4) Minutos finales y salida =====
  const res: CEEvaluado[] = tmp.map((t) => {
    const dif = clamp(Math.round(t.blend), 1, 5);
    let mins = t.minutosPropuestos != null ? round5(t.minutosPropuestos) : mapaMin[dif];
    mins = clamp(mins, 20, 120);

    return {
      ceId: t.id,
      dificultad: dif,
      minutosSugeridos: mins,
      prereqs: t.prereqs,
      justificacion: t.nota,
    };
  });

  return res;
}

/* =========================
 * Agrupados / prereqs
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

  objetivoOcupacion?: number;
  ajustarMinutos?: "auto" | "ninguno";
  partirCEsiNoCabe?: boolean;
  minBloque?: number;
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
    objetivoOcupacion: 0.92,
    ajustarMinutos: "auto",
    partirCEsiNoCabe: true,
    minBloque: 20,
  }
): Promise<Plan> {
  if (!ces.length || !sesiones.length) {
    return { items: [], cesNoUbicados: ces.map(c => c.id), metaCE: {} };
  }

  const objetivoOcupacion = Math.min(0.98, Math.max(0.6, opts.objetivoOcupacion ?? 0.92));
  const permitirPartir = opts.partirCEsiNoCabe ?? true;
  const minBloque = clamp5(opts.minBloque ?? 20);

  // 1) Dificultad + minutos
  let evals: CEEvaluado[] = [];
  if (opts.usarLLM) {
    try {
      evals = await evaluarConLLM(ces);
    } catch {
      evals = ces.map(heuristicaCE);
    }
  } else {
    evals = ces.map(heuristicaCE);
  }

  // ⚠️ Normalización y relleno defensivo: garantizamos 1 evaluación por CE
  const evalById = new Map<string, CEEvaluado>();
  for (const ce of ces) {
    let e =
      evals.find(x => x.ceId === ce.id) ??
      evals.find(x => (x as any).codigo === ce.codigo);

    if (!e) e = heuristicaCE(ce); // fallback

    e = {
      ceId: ce.id,
      dificultad: Math.min(5, Math.max(1, Math.round(e.dificultad))),
      minutosSugeridos: Math.min(120, Math.max(20, Math.round((e.minutosSugeridos ?? 35) / 5) * 5)),
      prereqs: Array.isArray(e.prereqs) ? e.prereqs.filter(Boolean) : [],
      justificacion: e.justificacion || "Heurística/LLM normalizado.",
    };

    evalById.set(ce.id, e);
  }

  // metaCE con justificación
  const metaCE: Record<string, { dificultad: number; minutos: number; justificacion?: string }> = {};
  for (const ce of ces) {
    const e = evalById.get(ce.id)!;
    metaCE[e.ceId] = { dificultad: e.dificultad, minutos: e.minutosSugeridos, justificacion: e.justificacion };
  }

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

  // --------- Ajuste previo de minutos para llenar capacidad ----------
  const capacidadTotal = sesiones.reduce((acc, s) => acc + s.minutos, 0);
  let demandaCE = linea.reduce((acc, n) => acc + n.mins, 0);
  if ((opts.ajustarMinutos ?? "auto") === "auto" && demandaCE > 0) {
    const target = Math.floor(capacidadTotal * objetivoOcupacion);
    if (target > demandaCE) {
      const factor = target / demandaCE;
      for (const n of linea) {
        n.mins = clampMinutos(n.mins * factor);
        const e = evalById.get(n.id)!;
        e.minutosSugeridos = n.mins;
        metaCE[n.id].minutos = n.mins;
      }
      demandaCE = linea.reduce((acc, n) => acc + n.mins, 0);
    }
  }

  // --------- EMPAQUETADO EN SESIONES (con particionado opcional) ----------
  function contarCEenSesion(items: ItemPlan[], sesionId: string) {
    return items.filter(it => it.sesionId === sesionId && it.tipo === "CE").length;
  }

  function empaquetar(secs: Sesion[], orden: Nodo[]) {
    const items: ItemPlan[] = [];
    const ocupados = new Array(secs.length).fill(0);
    const minutosAsignados = new Map<string, number>(); // por CE
    const cola: Nodo[] = orden.map(n => ({ ...n }));    // copia mutable
    const cupo = Math.max(1, opts.maxCEporSesion ?? 3);

    let idxSesion = 0;

    while (cola.length) {
      const n = cola.shift()!;
      const start = siguienteSesionLibre(idxSesion, secs, ocupados);
      if (start === null) break;
      idxSesion = start;

      let colocadoAlgunaParte = false;

      // 1) Intentar colocarlo entero
      for (let i = start; i < secs.length; i++) {
        const libre = capacidadRestante(secs[i], ocupados[i]);
        const enEsa = contarCEenSesion(items, secs[i].id);
        if (enEsa < cupo && n.mins <= libre) {
          items.push({ sesionId: secs[i].id, tipo: "CE", ceId: n.id, minutosOcupados: n.mins });
          ocupados[i] += n.mins;
          minutosAsignados.set(n.id, (minutosAsignados.get(n.id) ?? 0) + n.mins);
          colocadoAlgunaParte = true;
          break;
        }
      }

      if (!colocadoAlgunaParte && (opts.partirCEsiNoCabe ?? true)) {
        // 2) Partir en trozos cuando no cabe entero
        for (let i = start; i < secs.length; i++) {
          const enEsa = contarCEenSesion(items, secs[i].id);
          if (enEsa >= cupo) continue;

          let libre = capacidadRestante(secs[i], ocupados[i]);
          if (libre < minBloque) continue;

          const trozo = clamp5(Math.min(libre, Math.max(minBloque, Math.min(n.mins, 55))));
          if (trozo <= 0) continue;

          items.push({ sesionId: secs[i].id, tipo: "CE", ceId: n.id, minutosOcupados: trozo });
          ocupados[i] += trozo;
          minutosAsignados.set(n.id, (minutosAsignados.get(n.id) ?? 0) + trozo);
          const restante = n.mins - trozo;

          if (restante >= minBloque) {
            cola.push({ ...n, mins: restante }); // reintentamos más adelante
          }
          colocadoAlgunaParte = true;
          break;
        }
      }
      // Si no cabe, seguimos con el siguiente CE (no abortamos el empaquetado)
    }

    // CE con minutos asignados < requeridos
    const noUbicados = new Set<string>();
    for (const n of orden) {
      const req = evalById.get(n.id)!.minutosSugeridos;
      const asig = minutosAsignados.get(n.id) ?? 0;
      if (asig < req) noUbicados.add(n.id);
    }

    return { items, ocupados, noUbicados };
  }

  // 1er pase
  let { items, ocupados, noUbicados } = empaquetar(sesiones, linea);

  // --------- COMPACTACIÓN (recortar minutos si falta hueco) ----------
  if (noUbicados.size > 0 && opts.resolverFaltaHueco === "recortar") {
    const capLibre = sesiones.reduce((acc, s, i) => acc + Math.max(0, s.minutos - ocupados[i]), 0);
    const demandaPend = Array.from(noUbicados)
      .map(id => evalById.get(id)!.minutosSugeridos)
      .reduce((a, b) => a + b, 0);

    if (capLibre > 0 && demandaPend > 0) {
      const factor = Math.max(0.25, Math.min(1, capLibre / demandaPend));
      for (const id of noUbicados) {
        const e = evalById.get(id)!;
        const recorte = clampMinutos(e.minutosSugeridos * factor);
        e.minutosSugeridos = recorte;
        metaCE[id].minutos = recorte;
      }
      const nodosRe = linea.map(n => ({ ...n, mins: evalById.get(n.id)!.minutosSugeridos }));
      const re = empaquetar(sesiones, nodosRe);
      items = re.items; ocupados = re.ocupados; noUbicados = re.noUbicados;
    }
  }

  // --- helpers de reflow (NO mover CE de RAs evaluadas ni de la RA actual) ---
  function contarCEenSesionItems(items: ItemPlan[], sesionId: string) {
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
      const ceCount = contarCEenSesionItems(itemsTmp, sesId);
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

  // CE realmente no ubicados (por minutos)
  const minutosPorCE = new Map<string, number>();
  for (const it of items) {
    if (it.tipo === "CE" && it.ceId) {
      minutosPorCE.set(it.ceId, (minutosPorCE.get(it.ceId) ?? 0) + it.minutosOcupados);
    }
  }
  const cesNoUbicados = linea
    .filter(n => (minutosPorCE.get(n.id) ?? 0) < (evalById.get(n.id)!.minutosSugeridos))
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
