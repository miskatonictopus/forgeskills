// lib/plan-ui.ts
import type { Plan, Sesion as SesionSlot } from "./planificadorCE";

export type ItemLibre = { tipo: "libre"; titulo?: string };
export type ItemCE_UI = {
  tipo: "ce";
  raCodigo: string;
  ceCodigo: string;
  ceDescripcion: string;
  dificultad?: number;
  minutos?: number;
};
export type ItemEval_UI = { tipo: "eval"; raCodigo: string; titulo: string };

export type SesionUI = {
  _uid: string;
  indice: number;    // 1..N
  id: string;        // SesionSlot.id
  fecha?: string;
  items: Array<ItemCE_UI | ItemEval_UI | ItemLibre>;
};

// Genera uids
const uid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

/** Mapea el plan a una estructura de UI amigable. */
export function planToUI(
  slots: SesionSlot[],
  plan: Plan,
  catalogoCE: Record<string, { raCodigo: string; ceCodigo: string; ceDescripcion: string }>
): SesionUI[] {
  const byId = new Map<string, SesionUI>(
    slots.map((s, i) => [
      s.id,
      { _uid: uid(), indice: i + 1, id: s.id, fecha: s.fechaISO, items: [] },
    ])
  );

  for (const it of plan.items) {
    const s = byId.get(it.sesionId);
    if (!s) continue;

    if (it.tipo === "CE" && it.ceId) {
      const info = catalogoCE[it.ceId];
      const meta = plan.metaCE[it.ceId];
      if (info) {
        s.items.push({
          tipo: "ce",
          raCodigo: info.raCodigo,
          ceCodigo: info.ceCodigo,
          ceDescripcion: info.ceDescripcion,
          dificultad: meta?.dificultad,
          minutos: meta?.minutos,
        });
      }
    } else if (it.tipo === "EVALUACION_RA" && it.raCodigo) {
      s.items.push({
        tipo: "eval",
        raCodigo: it.raCodigo,
        titulo: `Actividad evaluativa del ${it.raCodigo}`,
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.indice - b.indice);
}

/** ¿Sesión libre (vacía o con un único item "libre")? */
export function isLibre(s: SesionUI) {
  if (s.items.length === 0) return true;
  if (s.items.length === 1 && (s.items[0] as any).tipo === "libre") return true;
  return false;
}

/** Renumera índices 1..N tras un reordenado. */
export function renumerarIndices(ses: SesionUI[]) {
  return ses.map((s, i) => ({ ...s, indice: i + 1 }));
}

/** Valida que ninguna evaluación quede antes de terminar los CE de su RA. */
export function validarEvaluaciones(ses: SesionUI[]): string | null {
  const lastCEByRA = new Map<string, number>();
  ses.forEach((s, i) => {
    s.items.forEach((it) => {
      if ((it as any).tipo === "ce") {
        const ra = (it as ItemCE_UI).raCodigo;
        lastCEByRA.set(ra, Math.max(lastCEByRA.get(ra) ?? -1, i));
      }
    });
  });
  for (let i = 0; i < ses.length; i++) {
    for (const it of ses[i].items) {
      if ((it as any).tipo === "eval") {
        const ra = (it as ItemEval_UI).raCodigo;
        const last = lastCEByRA.get(ra) ?? -1;
        if (i <= last) return `La evaluación de ${ra} no puede ir antes de terminar sus CE.`;
      }
    }
  }
  return null;
}

/** Inserta item "libre" con título antes de guardar (si una sesión está vacía). */
export function materializarLibres(
  ses: SesionUI[],
  titulos: Record<number, string | undefined>
): SesionUI[] {
  return ses.map((s) => {
    if (isLibre(s)) {
      const t = (titulos[s.indice] ?? "").trim();
      if (t && s.items.length === 0) {
        return { ...s, items: [{ tipo: "libre", titulo: t }] };
      }
    }
    return s;
  });
}
