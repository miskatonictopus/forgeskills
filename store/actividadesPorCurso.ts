import { proxy } from "valtio"

export type Actividad = {
    id: string;
    nombre: string;
    fecha: string;
    cursoId: string;
    asignaturaId: string;
    descripcion?: string;
  };

type ActividadesPorCurso = Record<string, Actividad[]>

export const actividadesPorCurso = proxy<ActividadesPorCurso>({})

export async function cargarActividades(cursoId: string) {
  const actividades = await window.electronAPI.actividadesDeCurso(cursoId)
  actividadesPorCurso[cursoId] = actividades
}

export function añadirActividad(cursoId: string, actividad: Actividad) {
  if (!actividadesPorCurso[cursoId]) {
    actividadesPorCurso[cursoId] = []
  }
  actividadesPorCurso[cursoId].push(actividad)
}

