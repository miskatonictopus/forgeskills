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

  async cargarCursos() {
    const datos = await window.electronAPI.leerCursos()
    cursoStore.cursos = datos
  },

  async refrescar() {
    await cursoStore.cargarCursos()
  },
})
