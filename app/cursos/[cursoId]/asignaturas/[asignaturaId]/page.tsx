"use client"

import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useSnapshot } from "valtio"
import { cursoStore } from "@/store/cursoStore"
import { Dot } from "@/components/ui/Dot"
import TablaNotasCEAlumnos from "@/components/TablaNotasCEAlumnos"

// 👇 store de actividades
import {
  actividadesPorCurso,
  cargarActividades,
  estadoUI,
  type Actividad as ActividadStore,
} from "@/store/actividadesPorCurso"

type Alumno = { id: string; nombre: string; apellidos: string }
type CE = { codigo: string; descripcion: string }
type RA = { codigo: string; descripcion: string; CE: CE[] }
type Asignatura = { id: string; nombre: string; descripcion?: string; creditos?: string; color?: string; ra: RA[] }
type Curso = { id: string; acronimo: string; nombre: string; nivel: string; grado: string }

// Badge/Dot de estado
function EstadoDot({ estado }: { estado?: string }) {
  const map: Record<string, string> = {
    analizada: "bg-emerald-500",
    programada: "bg-sky-500",
    pendiente_evaluar: "bg-amber-500",
    evaluada: "bg-violet-500",
    borrador: "bg-zinc-500",
    cerrada: "bg-fuchsia-500",
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${map[estado ?? "borrador"]}`} />
}

export default function AsignaturaPage() {
  const { cursoId, asignaturaId } = useParams<{ cursoId: string; asignaturaId: string }>()
  const snapCursos = useSnapshot(cursoStore)
  const actsSnap = useSnapshot(actividadesPorCurso)

  const [asignatura, setAsignatura] = useState<Asignatura | null>(null)
  const [curso, setCurso] = useState<Curso | null>(null)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])

  // Carga datos de asignatura/curso/alumnos
  useEffect(() => {
    const fetchData = async () => {
      try {
        const asignaturaCompleta = await window.electronAPI.leerAsignatura(asignaturaId)
        setAsignatura(asignaturaCompleta)

        const cursoEncontrado = snapCursos.cursos.find((c) => c.id === cursoId)
        setCurso(cursoEncontrado || null)

        const alumnosCurso = await window.electronAPI.leerAlumnosPorCurso(cursoId)
        setAlumnos(alumnosCurso.map((a: any) => ({ ...a, id: String(a.id) })))
      } catch (error) {
        console.error("❌ Error al cargar datos de asignatura:", error)
        setAsignatura(null)
      }
    }
    fetchData()
  }, [cursoId, asignaturaId, snapCursos])

  // Carga actividades del curso (y normaliza estadoCanon en el store)
  useEffect(() => {
    if (cursoId) cargarActividades(cursoId)
  }, [cursoId])

  // Actividades de ESTA asignatura (ya en memoria)
  const actividadesAsignatura = useMemo(() => {
    const list = (actsSnap[cursoId] || []) as ActividadStore[]
    return list
      .filter((a) => a.asignaturaId === asignaturaId)
      .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha))
  }, [actsSnap, cursoId, asignaturaId])

  if (!curso) return <p className="p-4 text-sm text-muted-foreground">Cargando curso...</p>
  if (!asignatura) return <p className="p-4 text-sm text-muted-foreground">Asignatura no encontrada</p>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-4xl text-white font-bold flex items-center gap-2">
        <span className="text-4xl font-bold tracking-tight">
          {curso.acronimo.toUpperCase()}{curso.nivel}
        </span>
      </h1>

      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <Dot color={asignatura.color ?? "#9ca3af"} className="w-5 h-5" />
        {asignatura.id} {asignatura.nombre}
      </h1>

      {/* ===== LISTA DE ACTIVIDADES DE LA ASIGNATURA ===== */}
      <section className="rounded border border-muted bg-muted/10 p-4">
        <h2 className="text-xl font-semibold mb-3">Actividades</h2>

        {actividadesAsignatura.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividades para esta asignatura.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {actividadesAsignatura.map((a) => {
              const ev = a.estadoCanon ?? estadoUI(a) // 👈 estado canónico
              return (
                <li key={a.id} className="rounded-md border border-zinc-800 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" title={a.nombre}>
                        {a.nombre}
                      </div>
                      {a.descripcion ? (
                        <div className="text-xs text-muted-foreground line-clamp-1" title={a.descripcion}>
                          {a.descripcion}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                        <EstadoDot estado={ev} />
                        <span className="capitalize">{ev.replaceAll("_", " ")}</span>
                      </div>
                      <div className="text-[11px] tabular-nums text-zinc-400 mt-1">
                        {new Date(a.fecha).toLocaleDateString("es-ES")}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ===== TABLA CE × ALUMNOS ===== */}
      {asignatura.ra?.length > 0 && alumnos.length === 0 && (
        <p className="text-sm text-muted-foreground">Cargando alumnos…</p>
      )}

      {asignatura.ra?.length > 0 && alumnos.length > 0 && (
        <div className="mt-3">
          <h2 className="text-lg font-semibold mb-4">Notas por Criterio de Evaluación</h2>
          <TablaNotasCEAlumnos alumnos={alumnos} ra={asignatura.ra} />
        </div>
      )}
    </div>
  )
}
