// app/api/planificar-ce/stream/route.ts
import { NextRequest } from "next/server";
import { ensureOpenAI } from "@/lib/openai";

type LLMCE = { id: string; codigo: string; descripcion: string; raCodigo: string };
type LLMSesion = { id: string; fechaISO?: string; minutos: number };
type StreamTick = { current: number; total: number; message?: string; done?: boolean; error?: string; plan?: unknown };

export const runtime = "nodejs";         // asegura entorno Node (necesario si luego hay SDKs nativos)
export const dynamic = "force-dynamic";  // evita cacheo de Vercel/Next

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function encoderLine(obj: StreamTick) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { ces, sesiones, opts } = (await req.json()) as {
    ces: LLMCE[];
    sesiones: LLMSesion[];
    opts?: {
      usarLLM?: boolean;
      insertarEvaluacionRA?: boolean;
      penalizarSaltosTema?: boolean;
      resolverFaltaHueco?: "ninguno" | "recortar";
    };
  };

  // Guard: si se pide LLM, exige OPENAI_API_KEY (501)
  if (opts?.usarLLM) {
    const openai = ensureOpenAI();
    if (!openai) {
      // Devolvemos SSE con un único evento de error y status 501 (para que el cliente lo detecte)
      const payload = encoderLine({ current: 0, total: 1, error: "OPENAI_API_KEY missing", done: true });
      return new Response(payload, { headers: sseHeaders(), status: 501 });
    }
  }

  const total = 5; // nº de pasos a reportar
  const urlBase = new URL(req.url);
  const planificarUrl = new URL("/api/planificar-ce", urlBase.origin).toString();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (tick: StreamTick) => controller.enqueue(enc.encode(encoderLine(tick)));
      const step = async (current: number, message: string) => send({ current, total, message });

      try {
        await step(0, "Preparando datos…");
        // (validaciones ligeras aquí si quieres)

        await step(1, "Analizando RA/CE…");
        await step(2, "Calculando sesiones…");

        await step(3, "LLM trabajando en la planificación… (puede tardar un poco)");

        const resp = await fetch(planificarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ces, sesiones, opts }),
          cache: "no-store",
        });

        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(txt || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        if (!data?.ok) throw new Error(data?.error || "El planificador devolvió un error.");

        const plan = data.plan;

        await step(4, "Construyendo UI…");

        // Final
        send({ current: total, total, done: true, plan });
      } catch (e: any) {
        send({ current: 0, total, error: e?.message || "Error desconocido" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
