import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analizarTexto(prompt: string): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Devuelve solo un array JSON de códigos CE relevantes.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
  });

  const contenido = completion.choices[0].message.content ?? "[]";

  // 🔧 Limpiamos el bloque ```json ... ``` si lo hubiera
  const limpio = contenido.replace(/```json|```/g, "").trim();

  try {
    const resultado = JSON.parse(limpio);

    if (Array.isArray(resultado) && resultado.every((x) => typeof x === "string")) {
      return resultado;
    } else {
      console.error("⚠️ El resultado no es un array válido de strings:", resultado);
      return [];
    }
  } catch (err) {
    console.error("❌ Error al parsear el contenido como JSON:", limpio, err);
    return [];
  }
}
