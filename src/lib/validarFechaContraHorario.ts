// src/lib/validarFechaContraHorario.ts
// Usamos SIEMPRE el IPC "horarios-de-asignatura" como fuente de verdad.

type Bloque = { diaSemana: number; horaInicio: string; horaFin: string };

// 0=domingo ... 6=sábado  (igual que JS Date.getDay())
export function diaSemana(dateISO: string) {
  const d = new Date(dateISO);
  return d.getDay();
}

// Normaliza Wednesday con o sin acento por si en algún lugar lo usas como texto
export function normalizaDiaTexto(x: string) {
  const s = (x || "").toLowerCase().trim();
  if (s === "miercoles") return "miércoles";
  if (s === "sabado") return "sábado";
  return s;
}

/**
 * Valida si la fecha (YYYY-MM-DD) cae en algún día que tenga horario
 * para {cursoId, asignaturaId}. Devuelve también los bloques para mensajes.
 */
export async function validarFechaConHorario(
  cursoId: string,
  asignaturaId: string,
  yyyyMMdd: string
): Promise<{ ok: boolean; bloques: Bloque[]; motivo?: string }> {
  // Pedimos los bloques normalizados al main
  const res = await window.electronAPI.getHorariosAsignatura(cursoId, asignaturaId); // => [{ diaSemana: 1..5, horaInicio:"09:00", horaFin:"11:00" }, ...]

  const bloques = Array.isArray(res) ? (res as Bloque[]) : [];

  if (bloques.length === 0) {
    return {
      ok: true, // sin horario: no bloqueamos guardar; lo controlará "programar"
      bloques: [],
    };
  }

  const d = new Date(`${yyyyMMdd}T12:00:00`);
  const dow = d.getDay(); // 0..6

  const hay = bloques.some((b) => Number(b.diaSemana) === Number(dow));
  return {
    ok: hay,
    bloques,
    motivo: hay ? undefined : "La fecha seleccionada no coincide con ningún día con horario.",
  };
}
