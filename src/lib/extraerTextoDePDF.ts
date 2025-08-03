import fs from "fs";
const pdf = require("pdf-parse");

/**
 * Extrae el texto plano de un PDF.
 * @param rutaPDF Ruta absoluta al archivo PDF.
 */
export async function extraerTextoDePDF(rutaPDF: string): Promise<string> {
  const dataBuffer = fs.readFileSync(rutaPDF);

  try {
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error("❌ Error al extraer texto del PDF:", error);
    throw new Error("Error al procesar el PDF.");
  }
}
