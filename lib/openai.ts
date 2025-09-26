// lib/openai.ts
import OpenAI from "openai";

/** Devuelve una instancia lista o null si falta la clave */
export function ensureOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}
