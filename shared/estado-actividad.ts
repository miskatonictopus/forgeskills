export type EstadoActividad =
  | "borrador"
  | "analizada"
  | "programada"
  | "pendiente_evaluar"
  | "evaluada"
  | "cerrada";

export const ESTADOS: EstadoActividad[] = [
  "borrador","analizada","programada","pendiente_evaluar","evaluada","cerrada",
];

export const ETIQUETA: Record<EstadoActividad,string> = {
  borrador:"Borrador",
  analizada:"Analizada",
  programada:"Programada",
  pendiente_evaluar:"Pendiente de evaluar",
  evaluada:"Evaluada",
  cerrada:"Cerrada",
};

export const TRANSICIONES: Record<EstadoActividad, EstadoActividad[]> = {
  borrador: ["analizada"],
  analizada: ["programada", "pendiente_evaluar"],
  programada: ["pendiente_evaluar", "cerrada"],
  pendiente_evaluar: ["evaluada", "cerrada"],
  evaluada: ["cerrada"],
  cerrada: [],
};

export function puedeTransicionar(
  actual: EstadoActividad,
  siguiente: EstadoActividad
): boolean {
  return TRANSICIONES[actual]?.includes(siguiente);
}
