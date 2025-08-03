import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `
      Eres un asistente experto en evaluación educativa.
      
      Tu tarea es analizar una actividad descrita por el usuario y, basándote en una lista de Criterios de Evaluación (CE), devolver exclusivamente los códigos CE que se correspondan con la actividad descrita.
      
      - Devuelve **solo un array JSON plano**, como: ["CE1.2", "CE2.4", "CE3.1"]
      - No expliques nada.
      - No inventes códigos que no están en el listado del usuario.
      - Si no hay ningún CE adecuado, devuelve: []
      `.trim()
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  });

  const texto = completion.choices[0].message.content ?? "[]";

  try {
    const resultado = JSON.parse(texto);
    return Response.json({ resultado });
  } catch (err) {
    return Response.json({ resultado: [], error: "Formato inválido" }, { status: 400 });
  }
}
