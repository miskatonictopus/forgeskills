export function colorDeAsignatura(a: { id: string; color?: string }) {
    if (a.color) return a.color;             // ya viene definido (caso AsignaturaCard)
    // fallback determinista desde id → HSL
    let h = 0;
    for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) % 360;
    return `hsl(${h} 80% 55%)`;
  }
  