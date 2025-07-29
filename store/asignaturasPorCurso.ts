import { proxy } from "valtio"

type Asignatura = {
  id: string
  nombre: string
}

type Store = {
  asignaturasPorCurso: Record<string, Asignatura[]>
  setAsignaturasCurso: (cursoId: string, asignaturas: Asignatura[]) => void
}

export const store = proxy({
  asignaturasPorCurso: {} as Record<string, Asignatura[]>,
  
  setAsignaturasCurso(cursoId: string, asignaturas: Asignatura[]) {
    Reflect.set(store.asignaturasPorCurso, cursoId, asignaturas) // 🧠 clave reactiva
  },
})

// Export directo para facilidad
export const asignaturasPorCurso = store.asignaturasPorCurso
export const setAsignaturasCurso = store.setAsignaturasCurso
