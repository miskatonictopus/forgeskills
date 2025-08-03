import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Umbral ajustado para pruebas
const UMBRAL_SIMILITUD = 0.42;

export async function compararCEconActividad(
  descripcionActividad: string,
  codigo: string,
  descripcionCE: string
): Promise<{ codigo: string; puntuacion: number } | null> {
  try {
    // Embeddings
    const [actividadEmbedding, ceEmbedding] = await Promise.all([
      openai.embeddings.create({
        model: "text-embedding-3-large",
        input: descripcionActividad,
      }),
      openai.embeddings.create({
        model: "text-embedding-3-large",
        input: descripcionCE,
      }),
    ]);

    // Cosine similarity
    const sim = cosineSimilarity(
      actividadEmbedding.data[0].embedding,
      ceEmbedding.data[0].embedding
    );

    const puntuacion = parseFloat(sim.toFixed(4));

    // Mostrar log informativo
    console.log(
      `🧠 Comparación con ${codigo}: ${puntuacion} ${
        puntuacion >= UMBRAL_SIMILITUD ? "✅" : "❌"
      }`
    );

    // Evaluar umbral
    if (puntuacion >= UMBRAL_SIMILITUD) {
      return { codigo, puntuacion };
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
