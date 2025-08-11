// /lib/pdf/pdf.types.ts
export type CEItem = {
    codigo: string;
    texto: string;
    ra?: string;
    similitud?: number; // 0–1
  };
  
  export type ActividadInformeInput = {
    titulo: string;
    fechaISO: string;
    asignatura: string;
    descripcion?: string;
    umbral: number; // 0–100
    ces: CEItem[];
  };
  
  export type GenerarPDFOpts = {
    headerTitle?: string; // "Informe de actividad" por defecto
  };
  