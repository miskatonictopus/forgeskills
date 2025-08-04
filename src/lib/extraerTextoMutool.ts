import { execSync } from "child_process";

export function extraerTextoConMutool(pdfPath: string): string {
  try {
    const output = execSync(`mutool draw -F text -o - "${pdfPath}"`);
    return output.toString("utf-8").trim();
  } catch (err) {
    console.error("❌ Error extrayendo con mutool:", err);
    return "";
  }
}
