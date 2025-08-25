// scripts/transform_ifc_to_legacy.mjs
import fs from "fs/promises";
import path from "path";

const INPUT = process.argv[2] ?? "ifc_catedu.json";           // JSON nuevo (por ciclos)
const OUTPUT = process.argv[3] ?? "asignaturas_FP.json";      // JSON antiguo (plano)

const norm = (s) => (s ?? "").toString().trim();

function moduloToLegacy(mod) {
  return {
    id: norm(mod.codigo),
    nombre: norm(mod.nombre),
    // No intentes adivinar créditos; si quieres, mapéalos a mano luego
    creditos: undefined, // o norm(mod.creditos) si algún día lo añades al scraper
    descripcion: {
      duracion: mod.horas_totales != null ? `${mod.horas_totales}h` : undefined,
      centro: null,
      empresa: null,
    },
    CE: [], // tu esquema antiguo lo tenía a nivel raíz; mantenemos array vacío
    RA: (mod.RA ?? []).map((ra) => ({
      codigo: norm(ra.codigo),
      descripcion: norm(ra.descripcion),
      CE: (ra.CE ?? []).map((ce) => ({
        codigo: norm(ce.codigo),
        descripcion: norm(ce.descripcion),
      })),
    })),
  };
}

const main = async () => {
  const raw = await fs.readFile(path.resolve(INPUT), "utf8");
  const data = JSON.parse(raw);

  // data = [{ ciclo, codigo, nivel, modulos: [...] }, ...]
  const legacy = [];
  for (const ciclo of data) {
    for (const mod of ciclo.modulos || []) {
      // sólo módulos válidos con id y nombre
      if (norm(mod.codigo) && norm(mod.nombre)) {
        legacy.push(moduloToLegacy(mod));
      }
    }
  }

  // Ordena por id numérico y nombre para estabilidad
  legacy.sort((a, b) => {
    const ai = Number(a.id) || 0;
    const bi = Number(b.id) || 0;
    if (ai !== bi) return ai - bi;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  await fs.writeFile(path.resolve(OUTPUT), JSON.stringify(legacy, null, 2), "utf8");
  console.log(`✅ Generado ${OUTPUT} con ${legacy.length} asignaturas (formato legacy).`);
};

main().catch((e) => {
  console.error("❌ Error transformando:", e);
  process.exit(1);
});
