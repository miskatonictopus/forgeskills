// src/lib/platform.ts
export const platform = {
    async guardarCurso(data: any) {
      const res = await fetch("/api/cursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar curso");
      return res.json();
    },
  
    async obtenerCursos() {
      const res = await fetch("/api/cursos");
      if (!res.ok) throw new Error("Error al obtener cursos");
      return res.json();
    },
  
    async guardarAsignatura(data: any) {
      const res = await fetch("/api/asignaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar asignatura");
      return res.json();
    },
  
    async obtenerAsignaturas() {
      const res = await fetch("/api/asignaturas");
      if (!res.ok) throw new Error("Error al obtener asignaturas");
      return res.json();
    },
  
    // 👇 y así vas añadiendo: alumnos, actividades, pdf, etc.
  };
  