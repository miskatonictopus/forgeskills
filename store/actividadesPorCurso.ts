// store/actividadesPorCurso.ts
import { proxy } from "valtio";

/* ===== Tipos ===== */
export type Actividad = {
  id: string;
  nombre: string;
  fecha: string;           // "YYYY-MM-DD"
  cursoId: string;
  asignaturaId: string;
  descripcion?: string;

  estado?: "borrador" | "analizada" | "programada" | "enviada" | "pendiente" | "evaluada";
  analisisFecha?: string | null;
  umbralAplicado?: number | null;

  // ⬇️ vienen del backend (main.ipc "actividades-de-curso")
  programadaPara?: string | null; // "YYYY-MM-DD HH:mm" o "YYYY-MM-DDTHH:mm"
  programadaFin?: string | null;  // idem
};

/** Estructura para FullCalendar (suficiente para nuestros usos) */
export type FCEvent = {
  id: string;
  title: string;
  start?: string | Date;
  end?: string | Date;
  allDay?: boolean;
  classNames?: string[];
  backgroundColor?: string;
  extendedProps?: Record<string, any>;
};

type ActividadesPorCurso = Record<string, Actividad[]>;

export const actividadesPorCurso = proxy<ActividadesPorCurso>({});

/* ===== Helpers ===== */

/** "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" (sin tocar zona horaria) */
const asLocalDateTime = (s?: string | null) =>
  !s ? undefined : s.includes(" ") ? s.replace(" ", "T") : s;

  export function mapActividadesToFC(acts: Actividad[]): FCEvent[] {
    return acts
      .map((a) => {
        const start = asLocalDateTime(a.programadaPara);
        const end   = asLocalDateTime(a.programadaFin);
  
        if (!start) return null; // ⬅️ evitamos actividades sin horario
  
        return {
          id: a.id,
          title: a.nombre,
          start,
          end,
          allDay: false,
          classNames: [a.estado === "programada" ? "evt-programada" : "evt-borrador"],
          extendedProps: {
            cursoId: a.cursoId,
            asignaturaId: a.asignaturaId,
            estado: a.estado,
          },
        } as FCEvent;
      })
      .filter((e): e is FCEvent => e !== null); // ⬅️ aquí limpias los null
  }
  

/** Selector listo para el calendario */
export function eventosDeCurso(cursoId: string): FCEvent[] {
  const acts = actividadesPorCurso[cursoId] ?? [];
  return mapActividadesToFC(acts);
}

/* ===== Carga / Mutaciones ===== */

export async function cargarActividades(cursoId: string) {
  // Esta API ya devuelve programadaPara / programadaFin desde main.ts
  const actividades = await window.electronAPI.actividadesDeCurso(cursoId);
  actividadesPorCurso[cursoId] = actividades;
}

export function añadirActividad(cursoId: string, actividad: Actividad) {
  if (!actividadesPorCurso[cursoId]) {
    actividadesPorCurso[cursoId] = [];
  }
  actividadesPorCurso[cursoId].push(actividad);
}
