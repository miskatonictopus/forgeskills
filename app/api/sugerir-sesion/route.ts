// app/api/sugerir-sesion/route.ts
import { NextRequest, NextResponse } from "next/server";

/* =========================
 * Config
 * ========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const MODEL = process.env.LLM_SUGERENCIAS_MODEL ?? "gpt-4o";

/** Activa LLM si hay key con prefijo válido (sk-, sk-proj-, sk-live-, etc.) */
const USE_LLM = !!OPENAI_API_KEY && /^sk(-|\b)/.test(OPENAI_API_KEY);

/* =========================
 * Tipos
 * ========================= */
type MetodologiaId =
  | "abp" | "retos" | "flipped" | "gamificacion" | "estaciones"
  | "magistral+practica" | "cooperativo" | "taller";

type SugerenciaSesion = {
  sesionId: string;
  metodologia: MetodologiaId;
  fases: Array<{
    titulo: string;
    minutos: number;
    descripcion: string;
    /** El LLM puede devolver string o string[]; lo toleramos. */
    evidencias?: string | string[];
  }>;
  observaciones?: string;
};

type Recomendacion = { metodologia: MetodologiaId; score: number; motivo: string };

type ReqBody = {
  sesion: { id: string; minutos: number; metodologias?: MetodologiaId[] };
  ces: Array<{ codigo: string; descripcion: string; raCodigo: string; minutos?: number; dificultad?: number }>;
};

/* =========================
 * Utiles
 * ========================= */
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function fasesFallback(metodologia: MetodologiaId, total: number) {
  const p = (x: number) => round5(total * x);
  switch (metodologia) {
    case "magistral+practica":
      return [
        { titulo: "Activación", minutos: p(0.15), descripcion: "Activar previos (2-3 preguntas)." },
        { titulo: "Modelado breve", minutos: p(0.15), descripcion: "Demostración guiada." },
        { titulo: "Práctica guiada", minutos: p(0.5),  descripcion: "Checklist y apoyo docente." },
        { titulo: "Cierre y evidencias", minutos: clamp(total - (p(0.15)+p(0.15)+p(0.5)), 5, 120), descripcion: "Ticket de salida/mini-rúbrica." },
      ];
    case "flipped":
      return [
        { titulo: "Chequeo de visionado", minutos: p(0.15), descripcion: "Verificar comprensión inicial." },
        { titulo: "Práctica aplicada", minutos: p(0.65), descripcion: "Casos en parejas + feedback." },
        { titulo: "Cierre", minutos: clamp(total - (p(0.15)+p(0.65)), 5, 120), descripcion: "Síntesis y próximos pasos." },
      ];
    case "abp":
      return [
        { titulo: "Lanzamiento", minutos: p(0.2), descripcion: "Contexto/roles, criterios de éxito." },
        { titulo: "Desarrollo", minutos: p(0.6), descripcion: "Hitos cortos + dudas." },
        { titulo: "Cierre", minutos: clamp(total - (p(0.2)+p(0.6)), 5, 120), descripcion: "Entrega parcial y feedback." },
      ];
    case "retos":
      return [
        { titulo: "Planteamiento del reto", minutos: p(0.2), descripcion: "Enunciado + criterios." },
        { titulo: "Resolución por equipos", minutos: p(0.6), descripcion: "Estrategias y prototipos rápidos." },
        { titulo: "Puesta en común", minutos: clamp(total - (p(0.2)+p(0.6)), 5, 120), descripcion: "Demostraciones y feedback." },
      ];
    case "gamificacion":
      return [
        { titulo: "Briefing y reglas", minutos: p(0.2), descripcion: "Mecánicas y objetivos." },
        { titulo: "Misiones", minutos: p(0.6), descripcion: "Retos por estaciones/niveles." },
        { titulo: "Debriefing", minutos: clamp(total - (p(0.2)+p(0.6)), 5, 120), descripcion: "Reflexión + recompensas." },
      ];
    case "estaciones":
      return [
        { titulo: "Instrucciones y roles", minutos: p(0.15), descripcion: "Explicar rotaciones." },
        { titulo: "Rotaciones", minutos: p(0.7), descripcion: "3-4 estaciones con consignas." },
        { titulo: "Cierre", minutos: clamp(total - (p(0.15)+p(0.7)), 5, 120), descripcion: "Síntesis cruzada." },
      ];
    case "cooperativo":
      return [
        { titulo: "Activación", minutos: p(0.2), descripcion: "Estructura 1-2-4, ideas previas." },
        { titulo: "Desarrollo", minutos: p(0.6), descripcion: "Técnicas cooperativas (lápices al centro, rompecabezas)." },
        { titulo: "Cierre", minutos: clamp(total - (p(0.2)+p(0.6)), 5, 120), descripcion: "Producto compartido." },
      ];
    case "taller":
      return [
        { titulo: "Briefing y seguridad", minutos: p(0.2), descripcion: "Materiales y consignas." },
        { titulo: "Producción", minutos: p(0.65), descripcion: "Elaboración + asistencia puntual." },
        { titulo: "Exposición", minutos: clamp(total - (p(0.2)+p(0.65)), 5, 120), descripcion: "Muestra y feedback." },
      ];
    default:
      return [
        { titulo: "Activación", minutos: p(0.2), descripcion: "Explorar ideas previas." },
        { titulo: "Desarrollo", minutos: p(0.6), descripcion: "Actividad principal." },
        { titulo: "Cierre", minutos: clamp(total - (p(0.2)+p(0.6)), 5, 120), descripcion: "Síntesis y evidencias." },
      ];
  }
}

function elegirHeuristica(req: ReqBody): { recs: Recomendacion[]; sug: SugerenciaSesion[] } {
  const total = clamp(req.sesion.minutos || 55, 30, 120);
  const diffs = req.ces.map(c => c.dificultad ?? 3);
  const avg = diffs.length ? diffs.reduce((a,b)=>a+b,0)/diffs.length : 3;
  const tieneMuchosCE = req.ces.length >= 3;

  let candidatos: Recomendacion[] = [];
  if (avg >= 4 && req.ces.length >= 2) {
    candidatos = [
      { metodologia: "abp", score: 0.9,  motivo: "Tarea compleja con varios CE, idónea para proyecto." },
      { metodologia: "retos", score: 0.75, motivo: "Enfoque por desafío para alta complejidad." },
    ];
  } else if (avg <= 2 && req.ces.length <= 1) {
    candidatos = [
      { metodologia: "magistral+practica", score: 0.85, motivo: "Contenidos introductorios con guiado." },
      { metodologia: "flipped", score: 0.6, motivo: "Aprovecha el tiempo de aula en práctica." },
    ];
  } else if (tieneMuchosCE) {
    candidatos = [
      { metodologia: "estaciones", score: 0.8, motivo: "Distribuye varios CE en micro-tareas rotativas." },
      { metodologia: "cooperativo", score: 0.65, motivo: "Trabajo en equipo con interdependencia." },
    ];
  } else {
    candidatos = [
      { metodologia: "cooperativo", score: 0.6, motivo: "Aumentar interacción y co-construcción." },
      { metodologia: "magistral+practica", score: 0.55, motivo: "Breve input y práctica guiada." },
    ];
  }

  // Preferencias del profe (chips)
  const marcadas = new Set(req.sesion.metodologias ?? []);
  candidatos = candidatos.map(r =>
    marcadas.has(r.metodologia) ? { ...r, score: Math.min(0.99, r.score + 0.1) } : r
  ).sort((a,b)=> b.score - a.score);

  const top = candidatos.slice(0, 2);
  const sug: SugerenciaSesion[] = top.map(r => ({
    sesionId: req.sesion.id,
    metodologia: r.metodologia,
    fases: fasesFallback(r.metodologia, total),
    observaciones: r.motivo,
  }));
  return { recs: top, sug };
}

/* =========================
 * LLM (Plan A: Responses API con json_schema)
 * ========================= */
async function callLLM_Responses(req: ReqBody) {
  if (!USE_LLM) return null;

  const system = `Eres un diseñador instruccional. Devuelves SOLO JSON que cumple el esquema.
Propones 1-2 metodologías (entre: "abp","retos","flipped","gamificacion","estaciones","magistral+practica","cooperativo","taller")
para la sesión, con fases (título, minutos múltiplos de 5, breve descripción).
Incluye también "recomendadas" con score (0..1) y motivo.`;

  const schema = {
    type: "object",
    properties: {
      sugerencias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sesionId: { type: "string" },
            metodologia: { type: "string", enum: ["abp","retos","flipped","gamificacion","estaciones","magistral+practica","cooperativo","taller"] },
            fases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  minutos: { type: "integer" },
                  descripcion: { type: "string" },
                  evidencias: { anyOf: [
                    { type: "string" },
                    { type: "array", items: { type: "string" } }
                  ]},
                },
                required: ["titulo","minutos","descripcion"],
                additionalProperties: false
              }
            },
            observaciones: { type: "string" }
          },
          required: ["sesionId","metodologia","fases"],
          additionalProperties: false
        }
      },
      recomendadas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            metodologia: { type: "string", enum: ["abp","retos","flipped","gamificacion","estaciones","magistral+practica","cooperativo","taller"] },
            score: { type: "number" },
            motivo: { type: "string" }
          },
          required: ["metodologia","score","motivo"],
          additionalProperties: false
        }
      }
    },
    required: ["sugerencias"],
    additionalProperties: false
  };

  const payload = {
    model: MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ sesion: req.sesion, ces: req.ces }) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "SugerenciaMetodologia", schema }
    },
    max_output_tokens: 800,
    temperature: 0.3,
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) return null;
  const data = await resp.json();

  // Responses API: texto en data.output_text o en output[].content[].text
  const rawText =
    data?.output_text ??
    data?.output?.[0]?.content?.[0]?.text ??
    "";

  if (!rawText.trim()) return null;

  let parsed: any = null;
  try { parsed = JSON.parse(rawText); } catch { return null; }

  const sugs: SugerenciaSesion[] = Array.isArray(parsed?.sugerencias) ? parsed.sugerencias : [];
  const recs: Recomendacion[] = Array.isArray(parsed?.recomendadas) ? parsed.recomendadas : [];

  // Normaliza minutos
  const total = clamp(req.sesion.minutos || 55, 30, 120);
  for (const s of sugs) {
    for (const f of s.fases) f.minutos = clamp(round5(f.minutos), 5, 120);
    const sum = s.fases.reduce((a,b)=>a+b.minutos,0);
    const delta = total - sum;
    if (Math.abs(delta) >= 5 && s.fases.length) {
      s.fases[s.fases.length - 1].minutos = clamp(round5(s.fases[s.fases.length - 1].minutos + delta), 5, 120);
    }
    s.sesionId = s.sesionId || req.sesion.id;
  }

  return {
    recs,
    sug: sugs,
    usage: data?.usage ?? {},
    modelo: data?.model ?? MODEL
  };
}

/* =========================
 * LLM (Plan B: Chat Completions)
 * ========================= */
async function callLLM_Chat(req: ReqBody) {
  if (!USE_LLM) return null;

  const system = `Eres un diseñador instruccional. Devuelves SOLO JSON válido con las claves:
- "sugerencias": array de { sesionId, metodologia, fases[{titulo,minutos,descripcion,evidencias?}], observaciones? }
- "recomendadas": array de { metodologia, score(0..1), motivo }`;

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ sesion: req.sesion, ces: req.ces }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
    temperature: 0.3,
    seed: 4242,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(22000),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) return null;

  let parsed: any = null;
  try { parsed = JSON.parse(content); } catch { return null; }

  const sugs: SugerenciaSesion[] = Array.isArray(parsed?.sugerencias) ? parsed.sugerencias : [];
  const recs: Recomendacion[] = Array.isArray(parsed?.recomendadas) ? parsed.recomendadas : [];

  const total = clamp(req.sesion.minutos || 55, 30, 120);
  for (const s of sugs) {
    for (const f of s.fases) f.minutos = clamp(round5(f.minutos), 5, 120);
    const sum = s.fases.reduce((a,b)=>a+b.minutos,0);
    const delta = total - sum;
    if (Math.abs(delta) >= 5 && s.fases.length) {
      s.fases[s.fases.length - 1].minutos = clamp(round5(s.fases[s.fases.length - 1].minutos + delta), 5, 120);
    }
    s.sesionId = s.sesionId || req.sesion.id;
  }

  return {
    recs,
    sug: sugs,
    usage: data?.usage ?? {},
    modelo: data?.model ?? MODEL
  };
}

/* =========================
 * Handler
 * ========================= */
export async function POST(request: NextRequest) {
  try {
    const req = (await request.json()) as ReqBody;

    // ===== 1) LLM con Responses API
    let fuente: "llm" | "chat" | "fallback" = "fallback";
    let modelo: string | null = null;
    let usage: any = {};
    let out: { recs: Recomendacion[]; sug: SugerenciaSesion[] } | null = null;

    const r1 = await callLLM_Responses(req);
    if (r1 && r1.sug.length) {
      fuente = "llm";
      modelo = r1.modelo ?? MODEL;
      usage = r1.usage ?? {};
      out = { recs: r1.recs, sug: r1.sug };
    } else {
      // ===== 2) Plan B: Chat Completions
      const r2 = await callLLM_Chat(req);
      if (r2 && r2.sug.length) {
        fuente = "chat";
        modelo = r2.modelo ?? MODEL;
        usage = r2.usage ?? {};
        out = { recs: r2.recs, sug: r2.sug };
      }
    }

    // ===== 3) Fallback heurístico
    if (!out) {
      const h = elegirHeuristica(req);
      out = { recs: h.recs, sug: h.sug };
    }

    // ===== Log legible
    const safePreview = (o: any) =>
      JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "string" && v.length > 180 ? v.slice(0, 180) + "…" : v)));

    if (OPENAI_API_KEY) {
      console.log("KEY prefix:", OPENAI_API_KEY.slice(0, 6)); // sk-..., sk-pro...
    }

    console.log(
      "[/api/sugerir-sesion]",
      JSON.stringify(
        {
          fuente,
          modelo,
          usage,
          input: safePreview({ sesion: req.sesion, ces: req.ces }),
          output: safePreview({ recs: out.recs, sugerencias: out.sug }),
        },
        null,
        2
      )
    );

    return NextResponse.json({ ok: true, sugerencias: out.sug, recomendadas: out.recs, fuente, modelo, usage });
  } catch (e: any) {
    console.error("[/api/sugerir-sesion] error", e);
    return NextResponse.json({ ok: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
