"use client"

import { useState, useEffect } from "react"
import React from "react"

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
  const [notasRA, setNotasRA] = useState<Record<string, Record<string, string>>>({})

  const handleNotaChange = (ceCodigo: string, alumnoId: string, valor: string) => {
    setNotas((prev) => ({
      ...prev,
      [ceCodigo]: {
        ...prev[ceCodigo],
        [alumnoId]: valor,
      },
    }))
  }

  const handleNotaRAChange = (raCodigo: string, alumnoId: string, valor: string) => {
    setNotasRA((prev) => ({
      ...prev,
      [raCodigo]: {
        ...prev[raCodigo],
        [alumnoId]: valor,
      },
    }))
  }

  useEffect(() => {
    const nuevasNotasRA: Record<string, Record<string, string>> = {}

    ra.forEach((raItem) => {
      nuevasNotasRA[raItem.codigo] = {}
      alumnos.forEach((alumno) => {
        const notasCE = raItem.CE.map((ce) => parseFloat(notas[ce.codigo]?.[alumno.id] || ""))
          .filter((n) => !isNaN(n))

        const media = notasCE.length
          ? (notasCE.reduce((a, b) => a + b, 0) / notasCE.length).toFixed(1)
          : ""

        // Solo recalcula si no se ha editado manualmente
        if (!notasRA[raItem.codigo]?.[alumno.id]) {
          nuevasNotasRA[raItem.codigo][alumno.id] = media
        } else {
          nuevasNotasRA[raItem.codigo][alumno.id] = notasRA[raItem.codigo][alumno.id]
        }
      })
    })

    setNotasRA(nuevasNotasRA)
  }, [notas, ra, alumnos])

  return (
    <div className="overflow-auto max-h-[75vh] border rounded-xl shadow">
  <table className="min-w-max table-auto text-sm">
    <thead className="bg-muted/50">
    <tr className="sticky top-0 z-10 bg-muted border-b border-muted">
    <th className="sticky left-0 bg-muted px-4 py-2 font-medium text-left border-r border-muted">
          CE / RA / Alumno
        </th>
        {alumnos.map((a) => (
          <th key={a.id} className="px-4 py-2 font-medium text-left whitespace-nowrap">
            {a.apellidos}, {a.nombre}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {ra.map((raItem) => (
        <React.Fragment key={`ra-${raItem.codigo}`}>
          {/* Fila de RA */}
          <tr className="bg-muted/10 border-t">
  <td className="sticky left-0 bg-background font-semibold px-4 py-2 border-r border-muted w-150 whitespace-normal break-words">
    {raItem.codigo} – {raItem.descripcion}
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
        value={notasRA[raItem.codigo]?.[alumno.id] || ""}
        onChange={(e) =>
          handleNotaRAChange(raItem.codigo, alumno.id, e.target.value)
        }
      />
    </td>
  ))}
</tr>
          {/* Filas de CE */}
          {raItem.CE.map((ce) => (
            <tr key={ce.codigo} className="border-t">
              <td className="sticky left-0 bg-background px-4 py-2 text-muted-foreground border-r border-muted w-72 whitespace-normal break-words">
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
                    onChange={(e) =>
                      handleNotaChange(ce.codigo, alumno.id, e.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </React.Fragment>
      ))}
    </tbody>
  </table>
</div>

  )
}
