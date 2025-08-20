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
