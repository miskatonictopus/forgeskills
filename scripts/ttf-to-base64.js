// scripts/ttf-to-base64.js
const fs = require("fs");
const path = require("path");

function generarBase64(inputPath, exportName, outFile) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ No se encontró el archivo: ${inputPath}`);
    return;
  }

  const ttf = fs.readFileSync(inputPath);
  const base64 = ttf.toString("base64");

  const content = `export const ${exportName} = "${base64}";\n`;
  fs.writeFileSync(outFile, content);

  console.log(`✔ Generado ${outFile}`);
}

// Rutas de entrada/salida
generarBase64(
  "fonts/Geist/Geist-Regular.ttf",
  "GEIST_REG_TTF_BASE64",
  "lib/pdf/fonts/geist-regular.base64.ts"
);

generarBase64(
  "fonts/Geist/Geist-Bold.ttf",
  "GEIST_BOLD_TTF_BASE64",
  "lib/pdf/fonts/geist-bold.base64.ts"
);

console.log("🎉 Fuentes Geist (Regular y Bold) exportadas a Base64");
