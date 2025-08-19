// store/cursoStore.ts
import { proxy } from "valtio"

type Curso = {
  id: string
  acronimo: string
  nombre: string
  nivel: string
  grado: string
  clase: string
}

export const cursoStore = proxy({
  cursos: [] as Curso[],
  cursoIdActivo: null as string | null,

  setCursoActivo(id: string | null) {
    this.cursoIdActivo = id
  },

  get cursoActivo(): Curso | null {
    return this.cursos.find(c => c.id === this.cursoIdActivo) ?? null
  },

  async cargarCursos() {
    const data = await window.electronAPI.leerCursos()
    this.cursos = data
    // si no hay activo y hay cursos, selecciona el primero por defecto
    if (!this.cursoIdActivo && data.length > 0) this.cursoIdActivo = data[0].id
  },
})

