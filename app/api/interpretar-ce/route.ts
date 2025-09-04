import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Opcional: si usas Next.js en Node runtime (recomendado para OpenAI SDK)
// export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { resultado: [], error: "Falta 'prompt' (string no vacío)" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      seed: 4242,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Eres un asistente experto en evaluación educativa.

Tu tarea es analizar una actividad descrita por el usuario y, basándote en una lista de Criterios de Evaluación (CE), devolver EXCLUSIVAMENTE los códigos CE que se correspondan con la actividad descrita.

Requisitos de salida:
- Devuelve SOLO JSON con la forma {"resultado":["CE1.2","CE2.4","CE3.1"]}.
- No incluyas textos adicionales, ni comentarios.
- No inventes códigos que no estén en el listado del usuario (si te lo proporcionan).
- Si no hay ningún CE adecuado, devuelve {"resultado":[]}.
        `.trim(),
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? `{"resultado":[]}`;
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      // Defensa final (debería ser raro con response_format)
      return NextResponse.json(
        { resultado: [], error: "Formato inválido del modelo" },
        { status: 400 }
      );
    }

    // Validación mínima: { resultado: string[] }
    const arr = (parsed as any)?.resultado;
    if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) {
      return NextResponse.json(
        { resultado: [], error: "El modelo no devolvió un array de strings" },
        { status: 400 }
      );
    }

    return NextResponse.json({ resultado: arr });
  } catch (err: any) {
    console.error("[/api/CE-deteccion] Error:", err?.stack || err);
    return NextResponse.json(
      { resultado: [], error: "Error interno" },
      { status: 500 }
    );
  }
}
