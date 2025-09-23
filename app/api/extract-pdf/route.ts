// app/api/extract-pdf/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Falta 'file' en el FormData" }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const u8 = new Uint8Array(ab);   // → pdfjs-dist
    const buf = Buffer.from(u8);     // → pdf-parse
    if (!u8.byteLength) {
      return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
    }

    let text = "";

    // 1) pdf-parse (forzando la entrada CJS real para evitar leer ficheros de test)
    try {
      const mod: any = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = mod?.default ?? mod;
      const res = await pdfParse(buf);
      text = (res?.text ?? "").trim();
    } catch (e) {
      console.warn("[extract-pdf] pdf-parse error:", e);
    }

    // 2) pdfjs-dist si no se obtuvo texto
    if (!text) {
      try {
        text = await extractWithPdfjs(u8); // OJO: Uint8Array
      } catch (e) {
        console.warn("[extract-pdf] pdfjs-dist error:", e);
      }
    }

    // 3) OCR (opcional) — desactivado para simplificar el primer paso
    // if (!text) text = await ocrPdf(buf, { maxPages: 8, dpi: 180 });

    // Nunca devolvemos 500 por “no texto”: el cliente ya lo gestiona
    return NextResponse.json({
      text: (text || "").slice(0, 300_000),
      error: text ? undefined : "No se pudo extraer texto (puede ser un PDF escaneado).",
    });
  } catch (e) {
    console.error("[extract-pdf] fatal:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/* ----------------- helpers ----------------- */

async function extractWithPdfjs(data: Uint8Array): Promise<string> {
  // Preferir build legacy (v4); si no está, caer a la raíz
  let pdfjs: any = null;
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    try {
      pdfjs = await import("pdfjs-dist");
    } catch {
      return "";
    }
  }

  // Desactivar worker en Node para evitar buscar pdf.worker.mjs
  if (pdfjs?.GlobalWorkerOptions) {
    try { pdfjs.GlobalWorkerOptions.workerSrc = undefined as any; } catch {}
    try { pdfjs.GlobalWorkerOptions.workerPort = undefined as any; } catch {}
  }

  const getDocument: any = pdfjs.getDocument;
  if (typeof getDocument !== "function") return "";

  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    // flags que evitan fake worker/eval en server
    // @ts-ignore
    disableWorker: true,
    // @ts-ignore
    useWorker: false,
    // @ts-ignore
    isEvalSupported: false,
    // @ts-ignore
    workerPort: null,
  } as any);

  const doc = await loadingTask.promise;
  const pages = Math.min(doc.numPages ?? 0, 100);

  const out: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const s = (content.items || [])
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (s) out.push(s);
  }
  return out.join("\n").trim();
}
