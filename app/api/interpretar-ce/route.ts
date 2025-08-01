import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Devuelve solo un array JSON de códigos CE relevantes." },
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
