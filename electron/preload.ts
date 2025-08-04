import { contextBridge, ipcRenderer } from "electron";
import type { Asignatura } from "../models/asignatura";
import type { Alumno, AlumnoEntrada } from "../models/alumno";

contextBridge.exposeInMainWorld("electronAPI", {
  // Nombres (para pruebas)
  guardarNombre: (nombre: string) =>
    ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),
  leerAsignatura: (id: string) => ipcRenderer.invoke("leer-asignatura", id),
  leerAsignaturas: () => ipcRenderer.invoke("leer-asignaturas"),
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
  guardarHorario: (horario: {
    asignaturaId: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
  }) => ipcRenderer.invoke("guardar-horario", horario),

  leerHorarios: (asignaturaId: string) =>
    ipcRenderer.invoke("leer-horarios", asignaturaId),
  leerHorariosTodos: () => ipcRenderer.invoke("leer-horarios-todos"),

  borrarHorario: (datos: {
    asignaturaId: string;
    dia: string;
    horaInicio: string;
  }) => ipcRenderer.invoke("borrar-horario", datos),

  actividadesDeCurso: (cursoId: string) =>
    ipcRenderer.invoke("actividades-de-curso", cursoId),

    guardarActividad: (actividad: { id: string; nombre: string; fecha: string; cursoId: string; asignaturaId: string }) =>
    ipcRenderer.invoke("guardar-actividad", actividad),

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

});
