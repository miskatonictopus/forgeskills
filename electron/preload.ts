// preload.ts
import { contextBridge, ipcRenderer } from "electron";
import type { Asignatura } from "../models/asignatura";
import type { AlumnoEntrada } from "../models/alumno";
import type {
  Festivo,
  FestivoCreate,
  Presencialidad,
  FCTTramo,
  GuardarActividadPayload,
  GuardarActividadResult,
} from "../types/electronAPI";

/* ========= Tipos locales necesarios ========= */
type GuardarHorarioIn = {
  cursoId: string;
  asignaturaId: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};
type BorrarHorarioIn = {
  cursoId: string;
  asignaturaId: string;
  dia: string;
  horaInicio: string;
};

type CalcularHorasOpts = {
  cursoId?: string;
  asignaturaId?: string;
  desde?: string;
  hasta?: string;
  incluirFechas?: boolean;
};

/* ====== Programación didáctica ====== */
type ItemCEPersist = {
  tipo: "ce";
  raCodigo: string;
  ceCodigo: string;
  ceDescripcion: string;
  dificultad?: number;
  minutos?: number;
};
type ItemEvalPersist = { tipo: "eval"; raCodigo: string; titulo: string };
type SesionPersist = {
  indice: number;
  fecha?: string;
  items: Array<ItemCEPersist | ItemEvalPersist>;
};

type GuardarProgramacionPayload = {
  asignaturaId: string;
  cursoId: string;
  generadoEn: string;
  totalSesiones: number;
  sesiones: SesionPersist[];
  planLLM?: unknown | null;
  meta?: { asignaturaNombre?: string; cursoNombre?: string };
  modeloLLM?: "gpt-4o" | "gpt-4o-mini" | null;
  replacePrev?: boolean;
  materializarActividades?: boolean;
};

type ProgResumen = {
  path: string;
  carpeta: string;
  bytes: number;
  sesiones: number;
};
type ProgGuardarResult =
  | { ok: true; id?: string; resumen?: ProgResumen; path?: string }
  | { ok: false; error: string };

/* ====== Render PDF (HTML→PDF ya lo manejas con 'informe:generar-html') ====== */
type RenderResult = { ok: true; path: string } | { ok: false; error: string };

/* ========= API expuesta ========= */
const api = {
  /* ================= NOMBRES / PRUEBAS ================= */
  guardarNombre: (nombre: string) =>
    ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),

  /* ================= CURSOS ================= */
  guardarCurso: (curso: {
    acronimo: string;
    nombre: string;
    nivel: string;
    grado: string;
    clase: string;
  }) => ipcRenderer.invoke("guardar-curso", curso),
  leerCursos: () => ipcRenderer.invoke("leer-cursos"),
  borrarCurso: (id: string) => ipcRenderer.invoke("borrar-curso", id),

  /* ================= ASIGNATURAS ================= */

  actualizarColorAsignatura: (id: string, color: string) =>
    ipcRenderer.invoke("actualizar-color-asignatura", id, color),
    leerAlumnos: () => ipcRenderer.invoke("leer-alumnos"),
  leerColoresAsignaturas: (cursoId: string) =>
    ipcRenderer.invoke("asignaturas:leer-colores-curso", cursoId),
  guardarAsignatura: (asignatura: Asignatura) =>
    ipcRenderer.invoke("guardar-asignatura", asignatura),
  leerAsignatura: (id: string) => ipcRenderer.invoke("leer-asignatura", id),

  leerAlumno: (id: string | number) => ipcRenderer.invoke("leer-alumno", id),
  leerAsignaturas: (cursoId: string) =>
    ipcRenderer.invoke("leer-asignaturas-curso", cursoId),

  asignaturasDeCurso: (cursoId: string) =>
    ipcRenderer.invoke("asignaturas-de-curso", cursoId),
    alumnoAsignaturasResumen: (alumnoId: string | number) =>
    ipcRenderer.invoke("alumno-asignaturas-resumen", alumnoId),
  listarColoresAsignaturas: () =>
    ipcRenderer.invoke("asignaturas:listar-colores"),

  getCEsAsignatura: (asignaturaId: string) =>
    ipcRenderer.invoke("get-ces-asignatura", asignaturaId) as Promise<
      {
        codigo: string;
        descripcion: string;
        CE: { codigo: string; descripcion: string }[];
      }[]
    >,
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) =>
    ipcRenderer.invoke("asociar-asignaturas-curso", cursoId, asignaturaIds),

  /* ================= ALUMNOS ================= */
  guardarAlumno: (alumno: AlumnoEntrada) =>
    ipcRenderer.invoke("guardar-alumno", alumno),
  leerAlumnosPorCurso: (cursoId: string) =>
    ipcRenderer.invoke("leer-alumnos-por-curso", cursoId),
  alumnosPorCurso: (cursoId: string) =>
    ipcRenderer.invoke("alumnos.por-curso", { cursoId }),


    obtenerAlumnosPorCurso: (cursoId: string) =>
    ipcRenderer.invoke("alumnos:obtener-por-curso", cursoId),



  
  /* ================= HORARIOS ================= */
  guardarHorario: (data: GuardarHorarioIn) =>
    ipcRenderer.invoke("guardar-horario", data),
  leerHorarios: (asignaturaId: string, cursoId?: string) =>
    ipcRenderer.invoke("leer-horarios", asignaturaId, cursoId),
  borrarHorario: (payload: BorrarHorarioIn) =>
    ipcRenderer.invoke("borrar-horario", payload),
  getHorariosAsignatura: (cursoId: string, asignaturaId: string) =>
    ipcRenderer.invoke("horarios-de-asignatura", { cursoId, asignaturaId }),
  horariosDeAsignatura: (params: { cursoId: string; asignaturaId: string }) =>
    ipcRenderer.invoke("horarios-de-asignatura", params),

  /* ================= ACTIVIDADES ================= */
  actividadesDeCurso: (cursoId: string) =>
    ipcRenderer.invoke("actividades-de-curso", cursoId),
  guardarActividad: (payload: GuardarActividadPayload) =>
    ipcRenderer.invoke(
      "guardarActividad",
      payload
    ) as Promise<GuardarActividadResult>,
  listarActividadesPorAsignatura: (cursoId: string, asignaturaId: string) =>
    ipcRenderer.invoke("actividades.listar-por-asignatura", {
      cursoId,
      asignaturaId,
    }),
  listarActividadesGlobal: () =>
    ipcRenderer.invoke("listar-actividades-global"),
  actualizarActividadFecha: (id: string, fecha: string) =>
    ipcRenderer.invoke("actualizar-actividad-fecha", id, fecha),
  borrarActividad: (actividadId: string) =>
    ipcRenderer.invoke("borrar-actividad", actividadId),
  // alias

  /* ================= RA / CE + Análisis ================= */
  obtenerRAPorAsignatura: (asignaturaId: string) =>
    ipcRenderer.invoke("obtener-ra-por-asignatura", asignaturaId),
  obtenerCEPorRA: (raId: string) =>
    ipcRenderer.invoke("obtener-ce-por-ra", raId),
  analizarDescripcion: (actividadId: string) =>
    ipcRenderer.invoke("analizar-descripcion", actividadId),
  analizarDescripcionDesdeTexto: (texto: string, asignaturaId: string) =>
    ipcRenderer.invoke("analizar-descripcion-desde-texto", texto, asignaturaId),
  guardarInformePDF: (data: Uint8Array, sugerido: string) =>
    ipcRenderer.invoke("guardar-informe-pdf", data, sugerido),

  onActividadesActualizadas: (cb: (p: { count: number }) => void) => {
    const h = (_e: unknown, p: { count: number }) => cb(p);
    ipcRenderer.on("actividades.actualizadas", h);
    return () => ipcRenderer.removeListener("actividades.actualizadas", h);
  },

  guardarAnalisisActividad: (actividadId: string, umbral: number, ces: any[]) =>
    ipcRenderer.invoke("actividad.guardar-analisis", {
      actividadId,
      umbral,
      ces,
    }),
  leerAnalisisActividad: (actividadId: string) =>
    ipcRenderer.invoke("actividad.leer-analisis", actividadId),

  /* ================= PROGRAMAR / DESPROGRAMAR ================= */
  actividadProgramar: (payload: {
    actividadId: string;
    startISO: string;
    duracionMin: number;
  }) => ipcRenderer.invoke("actividad:programar", payload),

  /* ================= LECTIVO / FESTIVOS / PRESENCIALIDAD / FCT ================= */
  leerRangoLectivo: () => ipcRenderer.invoke("lectivo:leer"),
  guardarRangoLectivo: (r: { start: string; end: string }) =>
    ipcRenderer.invoke("lectivo:guardar", r),

  listarFestivos: (): Promise<Festivo[]> =>
    ipcRenderer.invoke("festivos:listar"),
  crearFestivo: (f: FestivoCreate): Promise<Festivo> =>
    ipcRenderer.invoke("festivos:crear", f),
  borrarFestivo: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("festivos:borrar", id),

  listarPresencialidades: (): Promise<Presencialidad[]> =>
    ipcRenderer.invoke("presencialidades-listar"),
  crearPresencialidad: (p: {
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
  }): Promise<Presencialidad> =>
    ipcRenderer.invoke("presencialidades-crear", p),
  borrarPresencialidad: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("presencialidades-borrar", id),

  listarFCT: (): Promise<FCTTramo[]> => ipcRenderer.invoke("fct-listar"),
  crearFCT: (p: {
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
  }): Promise<FCTTramo> => ipcRenderer.invoke("fct-crear", p),
  borrarFCT: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("fct-borrar", id),

  /* ================= INFORMES (HTML → PDF) ================= */
  generarInformeActividadHTML: (
    input: any,
    suggestedFileName?: string
  ): Promise<RenderResult> =>
    ipcRenderer.invoke("informe:generar-html", { input, suggestedFileName }),

  /* ================= HORAS REALES ================= */
  calcularHorasReales: (opts?: CalcularHorasOpts) =>
    ipcRenderer.invoke("academico.calcular-horas-reales", opts),

  /* ================= PROGRAMACIÓN DIDÁCTICA ================= */
  guardarProgramacionDidactica: (payload: GuardarProgramacionPayload) =>
    ipcRenderer.invoke("prog:guardar", payload) as Promise<ProgGuardarResult>,
  revelarEnCarpeta: (fullPath: string) =>
    ipcRenderer.invoke("fs:reveal", fullPath) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  exportarProgramacionPDF: (html: string, jsonPath: string) =>
    ipcRenderer.invoke("pdf:exportProgramacion", { html, jsonPath }),

  /* ================= MISC ================= */
  obtenerMediasAlumnosCurso: (cursoId: string) =>
    ipcRenderer.invoke("curso:alumnos-medias-asignatura", cursoId),

  leerActividadesPorCurso: (cursoId: string) =>
    ipcRenderer.invoke("actividades.leer-por-curso", { cursoId }),

  // util genérico
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
};

/* Exponer en window */
contextBridge.exposeInMainWorld("electronAPI", api);

/* Declaración global para TS */
declare global {
  interface Window {}
}

export {};
