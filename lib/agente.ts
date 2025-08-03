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
        content: `Tu única tarea es devolver un array JSON de códigos CE relevantes (ej: ["CE1.1", "CE2.1"]). 
No añadas texto explicativo, ni etiquetas como "json", ni comentarios. 
Si el texto es el mismo, el resultado debe ser idéntico. 
No uses variantes en el orden ni en el formato.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.0, // máxima consistencia
    top_p: 1,
  });

  const contenido = completion.choices[0].message.content ?? "[]";

  // 🔧 Limpiamos por si añade ```json o similar
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
