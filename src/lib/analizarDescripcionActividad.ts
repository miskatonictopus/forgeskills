import Database from "better-sqlite3";
import { compararCEconActividad } from "../../lib/comparadorCE";

const db = new Database("data/db.sqlite");

type ActividadDB = { descripcion: string; asignatura_id: string };
type CE = { codigo: string; descripcion: string };
type AsignaturaRow = { RA: any };
type ResultadoCE = {
  codigo: string;
  descripcion: string;
  puntuacion: number;
  evidencias?: string[];
  reason?: "evidence" | "high_sim" | "lang_rule";
  justificacion?: string;              // 👈 nuevo
};

// ---------------- Configurable: sensibilidad ----------------
type SensitivityMode = "conservador" | "equilibrado" | "exploratorio";
type CeConfig = {
  HIGH_SIM_ACCEPT: number;
  HIGH_SIM_BONUS: number;
  REQ_BASE: number;
  FALLBACK_OBJ_MIN: number;
  TAU: number;
  TOPP: number;
  DELTA: number;
};

let CONFIG: CeConfig = {
  HIGH_SIM_ACCEPT: 0.62,
  HIGH_SIM_BONUS: 0.03,
  REQ_BASE: 2,
  FALLBACK_OBJ_MIN: 2,
  TAU: 0.35,
  TOPP: 0.80,
  DELTA: 0.07,
};

export function setCeSensitivity(mode: SensitivityMode) {
  if (mode === "conservador") {
    CONFIG = { HIGH_SIM_ACCEPT: 0.66, HIGH_SIM_BONUS: 0.02, REQ_BASE: 2, FALLBACK_OBJ_MIN: 3, TAU: 0.33, TOPP: 0.70, DELTA: 0.09 };
  } else if (mode === "exploratorio") {
    CONFIG = { HIGH_SIM_ACCEPT: 0.58, HIGH_SIM_BONUS: 0.04, REQ_BASE: 1, FALLBACK_OBJ_MIN: 2, TAU: 0.40, TOPP: 0.90, DELTA: 0.05 };
  } else {
    CONFIG = { HIGH_SIM_ACCEPT: 0.62, HIGH_SIM_BONUS: 0.03, REQ_BASE: 2, FALLBACK_OBJ_MIN: 2, TAU: 0.35, TOPP: 0.80, DELTA: 0.07 };
  }
}

// -------------------- Helpers generales --------------------
function norm(s: string) { return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(); }
function tokenize(s: string) { return norm(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean); }
function singularize(w: string) { return w.replace(/(aciones)$/,"acion").replace(/(iones)$/,"ion").replace(/(mente)$/,"").replace(/(es|s)$/,""); }
function stem3(w: string) { const s = singularize(w); return s.length >= 3 ? s.slice(0, 3) : s; }
function slidingWindows(tokens: string[], size = 50, step = 15) { const out: string[][] = []; for (let i=0;i<tokens.length;i+=step) out.push(tokens.slice(i,i+size)); return out; }

const VERBOS_BASE = [
  "identifica","identificar","caracteriza","caracterizar","describe","describir",
  "explica","explicar","analiza","analizar","compara","comparar","clasifica","clasificar",
  "reconoce","reconocer","utiliza","usar","usa","aplica","aplicar",
  "realiza","realizar","elabora","elaborar","informe","redacta","redactar",
  "estudia","estudiar","investiga","investigar","responde","responder",
  "completa","completar","ejercicio","actividad",
  "comparativa","comparacion","explicacion","descripcion","analisis"
];

function construirReglasCE(ce: { descripcion: string }) {
  const toks = tokenize(ce.descripcion);
  const acciones = new Set<string>(VERBOS_BASE);
  for (const t of toks) if (/(ar|er|ir)$/.test(t)) acciones.add(t);

  const objetos = new Set<string>();
  for (const t of toks) if (t.length >= 4) objetos.add(t);

  const desc = toks.join(" ");
  if (desc.includes("naveg")) { objetos.add("navegador"); objetos.add("browser"); objetos.add("cliente"); }
  if (desc.includes("ejec"))   { objetos.add("runtime"); objetos.add("motor"); objetos.add("engine"); objetos.add("interprete"); objetos.add("javascript"); }
  if (desc.includes("lenguaj")){ objetos.add("html"); objetos.add("css"); objetos.add("javascript"); objetos.add("typescript"); }

  const uniqByStem = (arr: string[]) => {
    const seen = new Set<string>(), out: string[] = [];
    for (const w of arr) { const st = stem3(w); if (st && !seen.has(st)) { seen.add(st); out.push(w); } }
    return out;
  };
  return { acciones: uniqByStem([...acciones]), objetos: uniqByStem([...objetos]) };
}

function intersectsByStem(a: string[], b: string[]) {
  const SA = new Set(a.map(stem3));
  for (const w of b) if (SA.has(stem3(w))) return true;
  return false;
}

// --------- Lenguajes del cliente (regla específica pero generalizable) ---------
const LANG_STEMS = new Set(["htm","css","jav","typ"]); // html, css, javascript/js, typescript/ts
function countLangsInStems(stems: Set<string>) { let n = 0; for (const st of LANG_STEMS) if (stems.has(st)) n++; return n; }

// --------- Priors temáticos/familia (globales, no hardcode de IDs) ----------
const TOPIC_LEX = {
  ce62_standards: ["estandar","estándar","w3c","html5","css3","norma","estandarizacion","estandarización","compatibilidad","validador","validator","semantica","semántica"],
  ce63_interface: ["interfaz","ui","contraste","jerarquia","jerarquía","tipografia","tipografía","layout","maquetacion","maquetación","responsive","público","publico","objetivo","adaptar","adaptación","diseño","componentes","patron","patrón"],
  ce64_navigation: ["navegacion","navegación","teclado","tabulacion","tabulación","focus","foco","raton","ratón","tactil","táctil","gestos","scroll","atajos","tabindex","aria","aria-label","foco visible"],
  ce65_usability: ["usabilidad","heuristica","heurística","nielsen","sus","test a/b","a/b","pruebas con usuarios","card sorting","tiempo de tarea","tasa de exito","tasa de éxito","feedback","encuesta"],
};

function countHits(tokens: string[], vocab: string[]) {
  const T = new Set(tokens.map(t => norm(t)));
  let n = 0;
  for (const v of vocab) if (T.has(norm(v))) n++;
  return n;
}

function computeTopicPriors(texto: string) {
  const toks = tokenize(texto);
  const hits = {
    ce62: countHits(toks, TOPIC_LEX.ce62_standards),
    ce63: countHits(toks, TOPIC_LEX.ce63_interface),
    ce64: countHits(toks, TOPIC_LEX.ce64_navigation),
    ce65: countHits(toks, TOPIC_LEX.ce65_usability),
  };
  const familyBias: Record<string, number> = {};
  const ceBias: Record<string, number> = {};

  const totalCE6Signal = hits.ce62 + hits.ce63 + hits.ce64 + hits.ce65;
  if (totalCE6Signal >= 3) familyBias["CE6"] = 0.04;
  else if (totalCE6Signal >= 1) familyBias["CE6"] = 0.02;

  if (hits.ce62 >= 2) ceBias["CE6.2"] = 0.04; else if (hits.ce62 >= 1) ceBias["CE6.2"] = 0.02;
  if (hits.ce63 >= 2) ceBias["CE6.3"] = 0.04; else if (hits.ce63 >= 1) ceBias["CE6.3"] = 0.02;
  if (hits.ce64 >= 2) ceBias["CE6.4"] = 0.04; else if (hits.ce64 >= 1) ceBias["CE6.4"] = 0.02;
  if (hits.ce65 >= 2) ceBias["CE6.5"] = 0.04; else if (hits.ce65 >= 1) ceBias["CE6.5"] = 0.02;

  const nonCE6Penalty = totalCE6Signal >= 3 ? -0.03 : (totalCE6Signal >= 1 ? -0.01 : 0);
  return { familyBias, ceBias, nonCE6Penalty };
}

// ---------------- Verificador ----------------
function verificarCEGeneral(ce: CE, texto: string, sim: number) {
  const reglas = construirReglasCE(ce);
  const tokens = tokenize(texto);

  const ceObjStems = new Set(reglas.objetos.map(stem3));
  const textStems = new Set(tokens.map(stem3));
  let objSignalAll = 0;
  for (const st of ceObjStems) if (textStems.has(st)) objSignalAll++;

  const size = 50;
  const step = tokens.length < size ? size : 15;
  const windows = slidingWindows(tokens, size, step);

  const evidencias: string[] = [];
  let hitsObj = 0;
  const seenSnippets = new Set<string>();

  for (const win of windows) {
    const objStemsEnWin = new Set<string>();
    for (const w of win) {
      const st = stem3(w);
      if (!st) continue;
      if (ceObjStems.has(st)) objStemsEnWin.add(st);
    }

    const acc = intersectsByStem(reglas.acciones, win);
    const obj = objStemsEnWin.size >= 1;
    const strong = acc && obj;
    const concept = objStemsEnWin.size >= 2;

    if (strong || concept) {
      const snippet = win.slice(0, 25).join(" ") + " …";
      if (!seenSnippets.has(snippet)) {
        seenSnippets.add(snippet);
        evidencias.push(snippet);
        hitsObj++;
      }
    }
  }

  let req = CONFIG.REQ_BASE;
  if (sim >= 0.80) req = 1;
  if (tokens.length > 900) req = 3;

  const ok = evidencias.length >= req && hitsObj > 0;
  const coverage = Math.min(1, evidencias.length / 3);

  return { ok, evidencias: evidencias.slice(0, 3), coverage, req, len: tokens.length, objSignalAll, textStems };
}

// ---------------- Justificación legible ----------------
function pickTermsFromText(ceTerms: string[], textoTokens: string[], max = 3) {
  const textSet = new Set(textoTokens.map(stem3));
  const hits: string[] = [];
  for (const t of ceTerms) {
    const st = stem3(t);
    if (st && textSet.has(st)) {
      hits.push(t);
      if (hits.length >= max) break;
    }
  }
  return hits;
}

function buildJustificacion(opts: {
  ce: CE;
  sim: number;
  reason: "evidence" | "high_sim" | "lang_rule";
  evidencias: string[];
  ceObjetos: string[];
  textoTokens: string[];
}) {
  const { sim, reason, evidencias, ceObjetos, textoTokens } = opts;
  const pct = (sim * 100).toFixed(1) + "%";

  const termHits = pickTermsFromText(ceObjetos, textoTokens, 3);
  const termPart = termHits.length
    ? `Términos del criterio presentes: ${termHits.map(t => `“${t}”`).join(", ")}. `
    : "";

  const why =
    reason === "evidence"
      ? `Coincidencia semántica (${pct}) y presencia de acción/objeto del CE en la descripción. `
      : reason === "lang_rule"
      ? `Coincidencia semántica (${pct}) y mención de varios lenguajes/formatos relevantes. `
      : `Alta similitud semántica (${pct}) y cobertura suficiente de conceptos. `;

  const evPart = evidencias.length
    ? `Evidencias: ${evidencias.map(s => `«${s}»`).join(" ")}`
    : "";

  return `${why}${termPart}${evPart}`.trim();
}

// -------------------- Analizador principal --------------------
export async function analizarDescripcionActividad(actividadId: string): Promise<ResultadoCE[]> {
  const actividad = db
    .prepare("SELECT descripcion, asignatura_id FROM actividades WHERE id = ?")
    .get(actividadId) as ActividadDB;

  if (!actividad) throw new Error("❌ Actividad no encontrada");

  const row = db
    .prepare("SELECT RA FROM asignaturas WHERE id = ?")
    .get(actividad.asignatura_id) as AsignaturaRow;

  if (!row?.RA) throw new Error("❌ RA no encontrados en asignatura");

  let raParsed: any[] = [];
  try {
    if (Buffer.isBuffer(row.RA)) raParsed = JSON.parse(row.RA.toString("utf-8"));
    else if (typeof row.RA === "string") raParsed = JSON.parse(row.RA);
    else raParsed = row.RA;
  } catch (err) {
    throw new Error("❌ Error al parsear los RA: " + err);
  }

  const todosCE: CE[] = [];
  for (const ra of raParsed) {
    if (Array.isArray(ra.CE)) {
      for (const ce of ra.CE) {
        todosCE.push({ codigo: ce.codigo, descripcion: ce.descripcion });
      }
    }
  }

  const PRIORS = computeTopicPriors(actividad.descripcion);

  const prelim: {
    codigo: string; descripcion: string; sim: number;
    evidencias: string[]; coverage: number; score: number;
    reason: "evidence" | "high_sim" | "lang_rule";
    justificacion: string;
  }[] = [];
  
  for (const ce of todosCE) {
    const match = await compararCEconActividad(actividad.descripcion, ce.codigo, ce.descripcion);
    if (!match) continue;
  
    const sim = match.puntuacion;
    const ver = verificarCEGeneral(ce, actividad.descripcion, sim);
  
    let accept = ver.ok;
    let reason: "evidence" | "high_sim" | "lang_rule" = "evidence";
    let coverage = ver.coverage;

    // Regla específica para CE de "lenguajes"
    if (!accept && /lenguaj/i.test(ce.descripcion)) {
      const langHits = countLangsInStems(ver.textStems);
      if (sim >= 0.55 && ver.evidencias.length >= 1 && langHits >= 2) {
        accept = true;
        reason = "lang_rule";
        coverage = Math.max(coverage, 0.04);
      }
    }
  
    // Fallback: sim alta + señal global de objetos CE ≥ min
    if (!accept && sim >= CONFIG.HIGH_SIM_ACCEPT && ver.objSignalAll >= CONFIG.FALLBACK_OBJ_MIN) {
      accept = true;
      reason = "high_sim";
      coverage = Math.max(coverage, CONFIG.HIGH_SIM_BONUS);
    }
  
    if (!accept) {
      console.log(`[CE-PIPE] ${ce.codigo} sim=${sim.toFixed(4)} ok=${ver.ok} -> reject`);
      continue;
    }

    // ---- Priors de tema/familia (suaves) ----
    const fam = ce.codigo.split(".")[0]; // "CE6"
    const famBias = PRIORS.familyBias[fam] ?? 0;
    const ceBias  = PRIORS.ceBias[ce.codigo] ?? 0;
    const nonFamPenalty = fam === "CE6" ? 0 : PRIORS.nonCE6Penalty;

    const baseScore = 0.8 * sim + 0.2 * coverage;
    let score = baseScore + famBias + ceBias + nonFamPenalty;
    if (score < 0) score = 0;
    if (score > 1) score = 1;

    // 🧠 Justificación legible
    const reglas = construirReglasCE(ce);
    const justificacion = buildJustificacion({
      ce,
      sim,
      reason,
      evidencias: ver.evidencias,
      ceObjetos: reglas.objetos,
      textoTokens: tokenize(actividad.descripcion),
    });
  
    prelim.push({
      codigo: ce.codigo,
      descripcion: ce.descripcion,
      sim,
      evidencias: ver.evidencias,
      coverage,
      score,
      reason,
      justificacion,
    });
  }
  
  // Ordenamos por puntuación
  prelim.sort((a, b) => b.score - a.score);

  // --- corte sparse configurable ---
  const tau = CONFIG.TAU;
  const exps = prelim.map(r => Math.exp(r.score / tau));
  const Z = exps.reduce((a,b)=>a+b, 0) || 1;
  const withP = prelim.map((r,i) => ({ ...r, p: exps[i] / Z }));

  const TOPP = CONFIG.TOPP;
  const DELTA = CONFIG.DELTA;

  const finalSel: typeof withP = [];
  let cum = 0;
  for (let i = 0; i < withP.length; i++) {
    finalSel.push(withP[i]);
    cum += withP[i].p;
    const next = withP[i+1];
    const margin = next ? (withP[i].score - next.score) : Infinity;
    if (cum >= TOPP || margin >= DELTA) break;
  }

  console.log("[CE-PIPE] resultado", finalSel.length, finalSel.slice(0, 8).map(r => r.codigo));

  return finalSel.map(r => ({
    codigo: r.codigo,
    descripcion: r.descripcion,
    puntuacion: Number(r.score.toFixed(4)),
    evidencias: r.evidencias,
    reason: r.reason,
    justificacion: r.justificacion,   // 👈 devolver la explicación
  }));
}

