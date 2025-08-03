import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Umbral configurable para todas las comparaciones
const UMBRAL_SIMILITUD = 0.42;

export async function compararCEconActividad(
  descripcionActividad: string,
  codigo: string,
  descripcionCE: string
): Promise<{ codigo: string; puntuacion: number } | null> {
  try {
    const [actividadEmbedding, ceEmbedding] = await Promise.all([
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: descripcionActividad,
      }),
      openai.embeddings.create({
        model: "text-embedding-3-small",
        input: descripcionCE,
      }),
    ]);

    const sim = cosineSimilarity(
      actividadEmbedding.data[0].embedding,
      ceEmbedding.data[0].embedding
    );

    if (sim >= UMBRAL_SIMILITUD) {
      return { codigo, puntuacion: parseFloat(sim.toFixed(4)) };
    } else {
      return null;
    }
  } catch (err) {
    console.error("❌ Error al comparar CE:", err);
    return null;
  }
}

// Cosine similarity entre vectores
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}
