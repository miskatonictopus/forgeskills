import { contextBridge, ipcRenderer } from "electron";
import type { Asignatura } from "../models/asignatura";
import type { Alumno } from "../models/alumno";

contextBridge.exposeInMainWorld("electronAPI", {
  // Nombres (para pruebas)
  guardarNombre: (nombre: string) =>
    ipcRenderer.invoke("guardar-nombre", nombre),
  leerNombres: () => ipcRenderer.invoke("leer-nombres"),
  leerAsignaturas: () => ipcRenderer.invoke("leer-asignaturas"),

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

  // Alumnos
  guardarAlumno: (alumno: Alumno) =>
    ipcRenderer.invoke("guardar-alumno", alumno),
  leerAlumnos: () => ipcRenderer.invoke("leer-alumnos"),

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
});
