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
      const data = await window.electronAPI.leerCursos()
      this.cursos = data
    },
  })
  
