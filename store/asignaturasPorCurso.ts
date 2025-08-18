"use client"
import { proxy } from "valtio"

export type Asignatura = {
  id: string
  nombre: string
  color?: string | null
}

type Store = {
  asignaturasPorCurso: Record<string, Asignatura[]>
  setAsignaturasCurso: (cursoId: string, asignaturas: Asignatura[]) => void
  setColorAsignatura: (asignaturaId: string, color: string | null) => void
}

export const store = proxy<Store>({
  asignaturasPorCurso: {},

  setAsignaturasCurso(cursoId, asignaturas) {
    // 👇 Mantén color si ya existía y viene vacío en el payload (por seguridad)
    const prev = store.asignaturasPorCurso[cursoId] ?? []
    const prevById = Object.fromEntries(prev.map(a => [a.id, a]))
    store.asignaturasPorCurso[cursoId] = asignaturas.map(a => ({
      ...a,
      color: a.color ?? prevById[a.id]?.color ?? null,
    }))
  },

  setColorAsignatura(asignaturaId, color) {
    for (const cid of Object.keys(store.asignaturasPorCurso)) {
      const arr = store.asignaturasPorCurso[cid]
      const idx = arr.findIndex(a => a.id === asignaturaId)
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], color }
      }
    }
  },
})

// ✅ Exports actuales
export const asignaturasPorCurso = store.asignaturasPorCurso
export const setAsignaturasCurso = store.setAsignaturasCurso

// 🔄 Escucha el evento que lanza AsignaturaCard al guardar color
if (typeof window !== "undefined") {
  window.addEventListener("asignatura:color:actualizado", (ev: any) => {
    const { asignaturaId, color } = ev.detail ?? {}
    if (asignaturaId !== undefined) {
      store.setColorAsignatura(asignaturaId, color || null)
    }
  })
}

/* =========================
   🚀 Nueva función para hidratar asignaturas
   ========================= */
export async function cargarAsignaturas(cursoId: string) {
  try {
    const asignaturas = await window.electronAPI.leerAsignaturasCurso(cursoId)
    // => [{ id, nombre, color }, ...]
    setAsignaturasCurso(cursoId, asignaturas)
  } catch (err) {
    console.error("Error cargando asignaturas del curso:", err)
  }
}
