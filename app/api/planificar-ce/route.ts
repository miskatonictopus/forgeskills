// app/api/planificar-ce/route.ts
import { NextRequest, NextResponse } from "next/server";
import { planificarCEs, type CE, type Sesion } from "@/lib/planificadorCE";
import { ensureOpenAI } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  ces: Array<CE>;          // { id, codigo, descripcion, raCodigo }
  sesiones: Array<Sesion>; // { id, minutos, fechaISO? }
  opts?: {
    usarLLM?: boolean;
    insertarEvaluacionRA?: boolean;
    penalizarSaltosTema?: boolean;
    resolverFaltaHueco?: "ninguno" | "recortar";
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!Array.isArray(body?.ces) || body.ces.length === 0) {
      return NextResponse.json({ ok: false, error: "Faltan CE" }, { status: 400 });
    }
    if (!Array.isArray(body?.sesiones) || body.sesiones.length === 0) {
      return NextResponse.json({ ok: false, error: "Faltan sesiones" }, { status: 400 });
    }

    // sanea CE
    const ces: CE[] = body.ces.map((c, i) => ({
      id: String(c.id ?? `CE-${i}`),
      codigo: String(c.codigo),
      descripcion: String(c.descripcion ?? ""),
      raCodigo: String(c.raCodigo),
    }));

    // sanea sesiones
    const sesiones: Sesion[] = body.sesiones.map((s, i) => ({
      id: String(s.id ?? `S${i + 1}`),
      minutos: Math.max(30, Number(s.minutos ?? 55)),
      fechaISO: s.fechaISO,
    }));

    // guard si usarLLM = true
    const opts = {
      usarLLM: true,
      insertarEvaluacionRA: true,
      penalizarSaltosTema: true,
      resolverFaltaHueco: "recortar" as const,
      ...(body.opts || {}),
    };

    if (opts.usarLLM) {
      const openai = ensureOpenAI();
      if (!openai) {
        return NextResponse.json(
          { ok: false, error: "OPENAI_API_KEY missing" },
          { status: 501 }
        );
      }
    }

    // ejecuta planificador
    const plan = await planificarCEs(ces, sesiones, opts);

    return NextResponse.json({ ok: true, plan });
  } catch (e: any) {
    console.error("[/api/planificar-ce] Error:", e?.stack || e);
    return NextResponse.json({ ok: false, error: e?.message || "Error interno" }, { status: 500 });
  }
}
