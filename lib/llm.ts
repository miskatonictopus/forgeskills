// lib/llm.ts
// Wrapper minimal para invocar el LLM en modo determinista (JSON).

import OpenAI from "openai";

export type LLMOpts = {
  model?: string;
  seed?: number;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function llmJson<T>(
  system: string,
  user: string,
  opts: LLMOpts = {}
): Promise<T> {
  const resp = await client.chat.completions.create({
    model: opts.model ?? "gpt-4o-mini",
    temperature: 0,
    seed: opts.seed ?? 4242,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = resp.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    throw new Error("LLM devolvió JSON inválido: " + content);
  }
}
