"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso"
import { cursoStore } from "@/store/cursoStore"
import { useSnapshot } from "valtio"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function AsignaturaPage() {
  const { cursoId, asignaturaId } = useParams<{ cursoId: string; asignaturaId: string }>()
  const snapAsignaturas = useSnapshot(asignaturasPorCurso)
  const snapCursos = useSnapshot(cursoStore)

  const [asignatura, setAsignatura] = useState<any | null>(null)
  const [cursoNombre, setCursoNombre] = useState<string>("")
  const [cursosCargados, setCursosCargados] = useState(false)

  useEffect(() => {
    if (snapCursos.cursos.length === 0) return // Esperamos a que se carguen cursos

    setCursosCargados(true)

    const asignaturasCurso = snapAsignaturas[cursoId]
    if (asignaturasCurso) {
      const encontrada = asignaturasCurso.find((a) => a.id === asignaturaId)
      setAsignatura(encontrada || null)
    }

    const curso = snapCursos.cursos.find((c) => c.id === cursoId)
    setCursoNombre(curso ? curso.acronimo || curso.nombre || "" : "")
  }, [cursoId, asignaturaId, snapAsignaturas, snapCursos])

  if (!cursosCargados) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando curso...</p>
  }

  if (!asignatura) {
    return <p className="p-4 text-sm text-muted-foreground">Asignatura no encontrada</p>
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg text-muted-foreground font-semibold">Curso: {cursoNombre}</h2>
      <h1 className="text-3xl font-bold tracking-tight">{asignatura.nombre}</h1>
      {asignatura.descripcion && (
        <p className="text-muted-foreground text-sm max-w-prose leading-relaxed">
          {asignatura.descripcion}
        </p>
      )}

      {asignatura.ra?.length > 0 && (
        <div className="space-y-4">
          {asignatura.ra.map((ra: any, index: number) => (
            <Card key={index} className="border-muted">
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg">
                  {ra.codigo} – {ra.descripcion}
                </h2>
                <Separator className="my-2" />
                <ul className="list-disc pl-5 space-y-1">
                  {ra.ce?.map((ce: any, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {ce.codigo}: {ce.descripcion}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
