"use client"

import { useState } from "react"

type Alumno = {
  id: string
  nombre: string
  apellidos: string
}

type CE = {
  codigo: string
  descripcion: string
}

type RA = {
  codigo: string
  descripcion: string
  CE: CE[]
}

type Props = {
  alumnos: Alumno[]
  ra: RA[]
}

export default function TablaNotasCEAlumnos({ alumnos, ra }: Props) {
  const [notas, setNotas] = useState<Record<string, Record<string, string>>>({})

  const handleNotaChange = (ceCodigo: string, alumnoId: string, valor: string) => {
    setNotas((prev) => ({
      ...prev,
      [ceCodigo]: {
        ...prev[ceCodigo],
        [alumnoId]: valor,
      },
    }))
  }

  return (
    <div className="overflow-x-auto border rounded-xl shadow">
      <table className="min-w-max table-auto text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="sticky left-0 bg-muted px-4 py-2 font-medium text-left border-r border-muted">
              CE / Alumno
            </th>
            {alumnos.map((a) => (
              <th key={a.id} className="px-4 py-2 font-medium text-left whitespace-nowrap">
                {a.apellidos}, {a.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ra.flatMap((resultado) =>
            resultado.CE.map((ce) => (
              <tr key={ce.codigo} className="border-t">
                <td className="sticky left-0 bg-background px-4 py-2 font-mono text-muted-foreground border-r border-muted min-w-[240px]">
                  {ce.codigo} – {ce.descripcion}
                </td>
                {alumnos.map((alumno) => (
                  <td key={alumno.id} className="px-2 py-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="10"
                      className="w-full border rounded px-2 py-1 text-xs bg-background"
                      value={notas[ce.codigo]?.[alumno.id] || ""}
                      onChange={(e) => handleNotaChange(ce.codigo, alumno.id, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
