// scripts/ttf-to-base64.js
const fs = require("fs");
const ttf = fs.readFileSync("pdf-templates/academico/fonts/Geist-VariableFont_wght.ttf");
const base64 = ttf.toString("base64");
fs.writeFileSync("lib/pdf/fonts/geist.base64.ts", `export const GEIST_TTF_BASE64="${base64}";\n`);
console.log("geist.base64.ts generado");