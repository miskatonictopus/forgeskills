export type MetodologiaId =
  | "abp"
  | "aad"
  | "flipped"
  | "gamificacion"
  | "estaciones"
  | "magistral+practica"
  | "cooperativo"
  | "taller";

export type FaseSugerida = {
  titulo: string;
  minutos: number;
  descripcion: string;
  evidencias?: string[];
};

export type SugerenciaSesion = {
  sesionId: string;
  metodologia: MetodologiaId;
  fases: FaseSugerida[];
  observaciones?: string;
};
