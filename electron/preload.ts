import { contextBridge, ipcRenderer } from "electron";
import type { Asignatura } from "../models/asignatura";
import type { Alumno, AlumnoEntrada } from "../models/alumno";
import type { Festivo, FestivoCreate, Presencialidad } from "../types/electronAPI";
import type { FCTTramo } from "../types/electronAPI"; 
import type { GuardarActividadPayload, GuardarActividadResult } from "../types/electronAPI";

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



contextBridge.exposeInMainWorld("electronAPI", {
  // Nombres (para pruebas)
  guardarNombre: (nombre: string) =>
    ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),
  leerAsignatura: (id: string) => ipcRenderer.invoke("leer-asignatura", id),
  leerAsignaturas: () => ipcRenderer.invoke("leer-asignaturas"),
  leerAsignaturasCurso: (cursoId: string) =>
    ipcRenderer.invoke("leer-asignaturas-curso", cursoId),
    actualizarColorAsignatura: (id: string, color: string) =>
    ipcRenderer.invoke("actualizar-color-asignatura", id, color),
  // Cursos (con clase e ID compuesto)
  guardarCurso: (curso: {
    acronimo: string;
    nombre: string;
    nivel: string;
    grado: string;
    clase: string;
  }) => ipcRenderer.invoke("guardar-curso", curso),

  leerCursos: () => ipcRenderer.invoke("leer-cursos"),
  borrarCurso: (id: string) => ipcRenderer.invoke("borrar-curso", id),

  // Asignaturas
  guardarAsignatura: (asignatura: Asignatura) =>
    ipcRenderer.invoke("guardar-asignatura", asignatura),
  asociarAsignaturasACurso: (cursoId: string, asignaturaIds: string[]) =>
    ipcRenderer.invoke("asociar-asignaturas-curso", cursoId, asignaturaIds),
  asignaturasDeCurso: (
    cursoId: string
  ): Promise<{ id: string; nombre: string }[]> =>
    ipcRenderer.invoke("leer-asignaturas-curso", cursoId),

  // Alumnos
  guardarAlumno: (alumno: AlumnoEntrada) =>
    ipcRenderer.invoke("guardar-alumno", alumno),
  leerAlumnos: () => ipcRenderer.invoke("leer-alumnos"),
  leerAlumnosPorCurso: (cursoId: string) =>
    ipcRenderer.invoke("leer-alumnos-por-curso", cursoId),

  // 🕒 Horarios
  guardarHorario: (data: GuardarHorarioIn) =>
    ipcRenderer.invoke("guardar-horario", data),

  leerHorarios: (asignaturaId: string, cursoId?: string) =>
    ipcRenderer.invoke("leer-horarios", asignaturaId, cursoId),
  leerHorariosTodos: () => ipcRenderer.invoke("leer-horarios-todos"),

  borrarHorario: (payload: {
    cursoId: string;
    asignaturaId: string;
    dia: string;
    horaInicio: string;
  }) => ipcRenderer.invoke("borrar-horario", payload),
  

  actividadesDeCurso: (cursoId: string) =>
    ipcRenderer.invoke("actividades-de-curso", cursoId),

    guardarActividad: (payload: GuardarActividadPayload) =>
    ipcRenderer.invoke("guardarActividad", payload) as Promise<GuardarActividadResult>,

    obtenerRAPorAsignatura: (asignaturaId: string) =>
    ipcRenderer.invoke("obtener-ra-por-asignatura", asignaturaId),

  obtenerCEPorRA: (raId: string) =>
    ipcRenderer.invoke("obtener-ce-por-ra", raId),

  analizarDescripcion: (actividadId: string) =>
    ipcRenderer.invoke("analizar-descripcion", actividadId),

  analizarDescripcionDesdeTexto: (texto: string, asignaturaId: string) =>
  ipcRenderer.invoke("analizar-descripcion-desde-texto", texto, asignaturaId),

  guardarPDF: (arrayBuffer: ArrayBuffer, nombre: string) =>
    ipcRenderer.invoke("guardar-pdf", arrayBuffer, nombre),
  extraerTextoPDF: (ruta: string) => ipcRenderer.invoke("extraer-texto-pdf", ruta),

  guardarInformePDF: (data: Uint8Array, sugerido: string) =>
    ipcRenderer.invoke("guardar-informe-pdf", data, sugerido),

  guardarAnalisisActividad: (actividadId: string, umbral: number, ces: any[]) =>
    ipcRenderer.invoke("actividad.guardar-analisis", { actividadId, umbral, ces }),
  
    leerAnalisisActividad: (actividadId: string) =>
    ipcRenderer.invoke("actividad.leer-analisis", actividadId),

    borrarActividad: (actividadId: string) =>
    ipcRenderer.invoke("borrar-actividad", actividadId),

    getHorariosAsignatura: (cursoId: string, asignaturaId: string) =>
    ipcRenderer.invoke("horarios-de-asignatura", { cursoId, asignaturaId }),

    horariosDeAsignatura: (params: { cursoId: string; asignaturaId: string }) =>
    ipcRenderer.invoke("horarios-de-asignatura", params),

    llistarActividadesGlobal: () => ipcRenderer.invoke("listar-actividades-global"),
    actualizarActividadFecha: (id: string, fecha: string) =>
      ipcRenderer.invoke("actualizar-actividad-fecha", id, fecha),

      leerRangoLectivo: () => ipcRenderer.invoke("lectivo:leer"),
  guardarRangoLectivo: (r: { start: string; end: string }) => ipcRenderer.invoke("lectivo:guardar", r),

  // Festivos
  listarFestivos: () => ipcRenderer.invoke("festivos:listar"),
  crearFestivo: (f: { start: string; end?: string | null; title: string }) =>
    ipcRenderer.invoke("festivos:crear", f),
  borrarFestivo: (id: string) => ipcRenderer.invoke("festivos:borrar", id),

  listarPresencialidades: (): Promise<Presencialidad[]> =>
    ipcRenderer.invoke("presencialidades-listar"),
  crearPresencialidad: (p: { diaSemana: number; horaInicio: string; horaFin: string }): Promise<Presencialidad> =>
    ipcRenderer.invoke("presencialidades-crear", p),
  borrarPresencialidad: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("presencialidades-borrar", id),
  
    listarFCT: (): Promise<FCTTramo[]> => ipcRenderer.invoke("fct-listar"),
    crearFCT: (p: { diaSemana: number; horaInicio: string; horaFin: string }): Promise<FCTTramo> =>
      ipcRenderer.invoke("fct-crear", p),
    borrarFCT: (id: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke("fct-borrar", id),

      exportarPDFDesdeHTML: (html: string, fileName: string) =>
    ipcRenderer.invoke("pdf:exportFromHTML", { html, fileName }),

});
