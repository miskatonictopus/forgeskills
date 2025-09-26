// app/api/generar-actividad/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripFences(raw: string) {
  if (!raw) return "";
  let s = raw.trim();

  // ```html ... ```  o  ``` ... ```
  s = s.replace(/^```(?:html|md|markdown)?\s*/i, "");
  s = s.replace(/\s*```$/i, "");

  // Si viniera un documento completo, quédate con el <body>
  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) s = bodyMatch[1].trim();

  return s;
}

type SeleccionItem = {
  raCodigo: string;
  raDescripcion: string;
  ceCodigo: string;
  ceDescripcion: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      duracionMin,
      seleccion,           // Array<SeleccionItem>
      asignaturaNombre,    // opcional, para contexto
      tono = "docente claro, preciso y práctico",
      idioma = "es",
    } = body as {
      duracionMin: number;
      seleccion: SeleccionItem[];
      asignaturaNombre?: string;
      tono?: string;
      idioma?: string;
    };

    if (!duracionMin || !Array.isArray(seleccion) || seleccion.length === 0) {
      return NextResponse.json(
        { error: "Faltan parámetros: duracionMin y seleccion[]" },
        { status: 400 }
      );
    }

    const ceLista = seleccion
      .map(
        (s) =>
          `• ${s.raCodigo}.${s.ceCodigo} — ${s.ceDescripcion}` +
          (s.raDescripcion ? ` (RA ${s.raCodigo}: ${s.raDescripcion})` : "")
      )
      .join("\n");

    const minutos = duracionMin;
    const horas = Math.floor(minutos / 60);
    const rem = minutos % 60;
    const etiquetaDuracion =
      minutos === 30 ? "30 minutos" : `${horas > 0 ? `${horas} h` : ""}${rem ? ` ${rem} min` : ""}`.trim();

    const systemPrompt = `
Eres un profesor experto en FP que diseña actividades de aula.
Devuelve SIEMPRE HTML limpio (solo <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <strong>, <em>, <code>, <hr>, <br/>).
No uses estilos inline. No uses <style>. Nada de scripts.
Redacta en ${idioma}, tono ${tono}.
`.trim();

    const userPrompt = `
Genera una ACTIVIDAD **EVALUABLE** (tipo prueba/examen individual) para la asignatura${
  asignaturaNombre ? ` "${asignaturaNombre}"` : ""
}, con **tiempo límite real de ${etiquetaDuracion}**, alineada estrictamente a los siguientes Criterios de Evaluación:

${ceLista}

**Instrucciones de redacción (devuelve SOLO HTML, sin estilos inline):**
<h2>Título sugerido</h2>

<h3>Enunciado</h3>
- Explica el objetivo de la prueba en 2-3 frases.
- La prueba debe poder resolverse **dentro de ${etiquetaDuracion}** sin depender del profesor.
- Trabajo **individual**. Indica claramente si se permite internet o no (por defecto, **no permitido** salvo documentación local).
- Indica **restricciones** y supuestos (datos de partida, versiones, límites, etc.).

<h3>Tareas obligatorias</h3>
- Lista numerada de tareas concretas y cerradas (3–6 ítems).
- Cada tarea debe mapear explícitamente a uno o varios CE (formato **RAx.CEy**).
- Evita la ambigüedad: especifica entradas, salidas y criterios de finalización.
- Si aplica, proporciona **casos de prueba** o criterios de verificación.

<h3>Entregables</h3>
- Qué debe entregar el alumno exactamente (p.ej., PDF con respuestas, proyecto .zip, capturas, enlace a repo).
- **Convención de nombres** (ej.: \`Apellidos_Nombre_Actividad01.zip\`).
- **Formato y estructura** (carpetas/archivos requeridos).
- Cómo subir/entregar (si no sabes la plataforma, indica “según indicaciones del profesor”).

<h3>Plan de tiempo (${etiquetaDuracion})</h3>
- 0'–5': lectura y dudas iniciales sobre el enunciado (sin resolver aún).
- 5'–${Math.max(10, duracionMin - 5)}': desarrollo de la prueba por el alumno.
- ${Math.max(duracionMin - 5, 0)}'–${duracionMin}': verificación final y empaquetado de entregables.

<h3>Rúbrica de evaluación (puntuación total 10 puntos)</h3>
- Tabla con columnas: **Criterio (RAx.CEy)**, **Básico (0.5x)**, **Medio (0.8x)**, **Avanzado (1.0x)**, **Evidencias**.
- Asigna **puntos** a cada CE hasta sumar **10** en total (muestra el total al final).
- Define ejemplos observables para cada nivel (qué ver/corregir).

<h3>Penalizaciones y criterios de corrección</h3>
- Entrega fuera de tiempo: hasta **-2 puntos**.
- No compila / no ejecuta / no sigue formato de entrega: **0 puntos** en los CE afectados.
- Copia/plagio: **0 en la prueba** (indícalo).
- Errores menores de formato: hasta **-0.5** total.

<h3>Cierre</h3>
- Lista de verificación (checklist) previa a la entrega (3–5 ítems).
- Recordatorio del tiempo y de la convención de nombres.

**Notas:**
- Referencia cada CE siempre por su **código** (RAx.CEy).
- Sé conciso y operativo; evita muletillas.
- No inventes normativa externa; céntrate en los CE y en hacer la prueba evaluable y corregible.
`.trim();

    // Guard: si falta la API Key, devolver 501 (no bloquea build)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 501 }
      );
    }

    // Llamada a OpenAI (fetch directo para no requerir SDK)
    const payload = {
      model: "gpt-4o", // o "gpt-4o-mini"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      // si quieres asegurar formato estricto JSON/HTML, puedes añadir response_format en modelos que lo soporten
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenAI error: ${resp.status} ${errTxt}` },
        { status: 500 }
      );
    }

    const data = await resp.json();
    let html = (data?.choices?.[0]?.message?.content ??
      "<p>No se pudo generar contenido.</p>").toString().trim();

    html = stripFences(html);

    return NextResponse.json({ html });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
