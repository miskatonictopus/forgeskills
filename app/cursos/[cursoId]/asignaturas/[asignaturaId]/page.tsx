"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useSnapshot } from "valtio"
import { cursoStore } from "@/store/cursoStore"
import TablaNotasCEAlumnos from "@/components/TablaNotasCEAlumnos"

// Tipos

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
  const [alumnos, setAlumnos] = useState<Alumno[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const asignaturaCompleta = await window.electronAPI.leerAsignatura(asignaturaId)
        setAsignatura(asignaturaCompleta)
  
        const cursoEncontrado = snapCursos.cursos.find((c) => c.id === cursoId)
        setCurso(cursoEncontrado || null)
  
        const alumnosCurso = await window.electronAPI.leerAlumnosPorCurso(cursoId)
        const alumnosTransformados = alumnosCurso.map((a: any) => ({
          ...a,
          id: String(a.id),
        }))
        setAlumnos(alumnosTransformados)
      } catch (error) {
        console.error("❌ Error al cargar datos de asignatura:", error)
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

      {asignatura.ra?.length > 0 && alumnos.length === 0 && (
        <p className="text-sm text-muted-foreground">Cargando alumnos…</p>
      )}

      {asignatura.ra?.length > 0 && alumnos.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">
            Notas por Criterio de Evaluación
          </h2>
          <TablaNotasCEAlumnos alumnos={alumnos} ra={asignatura.ra} />
        </div>
      )}
    </div>
  )
}
