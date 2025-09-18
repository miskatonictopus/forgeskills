// app/api/planificar-ce/stream/route.ts
import { NextRequest } from "next/server";

type LLMCE = { id: string; codigo: string; descripcion: string; raCodigo: string };
type LLMSesion = { id: string; fechaISO?: string; minutos: number };
type StreamTick = { current: number; total: number; message?: string; done?: boolean; error?: string; plan?: any };

export const runtime = "nodejs"; // asegura entorno Node

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
  // El cliente nos manda exactamente lo que antes mandabas a /api/planificar-ce
  const { ces, sesiones, opts } = (await req.json()) as {
    ces: LLMCE[];
    sesiones: LLMSesion[];
    opts: any;
  };

  const total = 5; // define los pasos que vas a reportar
  const urlBase = new URL(req.url);
  const planificarUrl = new URL("/api/planificar-ce", urlBase.origin).toString();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (tick: StreamTick) => controller.enqueue(new TextEncoder().encode(encoderLine(tick)));
      const step = async (current: number, message: string) => send({ current, total, message });

      try {
        await step(0, "Preparando datos…");
        // (si quieres, valida inputs aquí)

        await step(1, "Analizando RA/CE…");
        // (podrías hacer cálculos previos menores aquí)

        await step(2, "Calculando sesiones…");
        // (cualquier pre-proceso sobre `sesiones` si aplica)

        await step(3, "LLM trabajando en la planificación…(puede tardar un poco)");
        // Llamamos al endpoint que ya tienes hecho
        const resp = await fetch(planificarUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ces, sesiones, opts }),
          // IMPORTANTE: no usar cache aquí
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
        // OJO: aquí no mapeamos a UI (eso es del cliente),
        // solo devolvemos el plan para que el cliente haga su pipeline.

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
