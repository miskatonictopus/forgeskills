"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useSnapshot } from "valtio"
import { cursoStore } from "@/store/cursoStore"

// Tipos
type CE = {
  codigo: string
  descripcion: string
}

type RA = {
  codigo: string
  descripcion: string
  ce: CE[]
}

type Asignatura = {
  id: string
  nombre: string
  descripcion?: string
  creditos?: string
  color?: string
  ra: RA[]
}

type Curso = {
  id: string
  acronimo: string
  nombre: string
  nivel: string
  grado: string
}

export default function AsignaturaPage() {
  const { cursoId, asignaturaId } = useParams<{ cursoId: string; asignaturaId: string }>()
  const snapCursos = useSnapshot(cursoStore)

  const [asignatura, setAsignatura] = useState<Asignatura | null>(null)
  const [curso, setCurso] = useState<Curso | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const asignaturaCompleta = await window.electronAPI.leerAsignatura(asignaturaId)
        console.log("🎯 Resultado directo de leerAsignatura:", asignaturaCompleta)

        setAsignatura(asignaturaCompleta)
        const cursoEncontrado = snapCursos.cursos.find((c) => c.id === cursoId)
        setCurso(cursoEncontrado || null)
      } catch (error) {
        console.error("❌ Error al cargar asignatura:", error)
        setAsignatura(null)
      }
    }

    fetchData()
  }, [cursoId, asignaturaId, snapCursos])

  if (!curso) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando curso...</p>
  }

  if (!asignatura) {
    return <p className="p-4 text-sm text-muted-foreground">Asignatura no encontrada</p>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl text-white font-bold">
        {curso.acronimo.toUpperCase()}
        {curso.nivel}
      </h1>

      <h1 className="text-3xl font-light font-notojp tracking-tight">
        {asignatura.nombre}
      </h1>

      {asignatura.descripcion && (
        <p className="text-muted-foreground text-sm max-w-prose leading-relaxed">
          {asignatura.descripcion}
        </p>
      )}

      {asignatura.ra?.length > 0 && (
        <div className="space-y-8">
          {asignatura.ra.map((ra, index) => (
            <div key={index} className="space-y-2">
              <h3 className="text-base font-semibold text-white">
                {ra.codigo} – {ra.descripcion}
              </h3>

              {ra.ce?.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-muted">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-2 font-medium">Código CE</th>
                        <th className="px-4 py-2 font-medium">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ra.ce.map((ce, i) => (
                        <tr key={i} className="border-t hover:bg-muted/10">
                          <td className="px-4 py-2 font-mono text-muted-foreground">
                            {ce.codigo}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {ce.descripcion}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Sin criterios de evaluación definidos.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
