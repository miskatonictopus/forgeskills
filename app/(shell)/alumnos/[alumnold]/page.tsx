// app/(shell)/alumnos/[alumnoId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";

type Alumno = {
  id: string;
  nombre: string;
  apellidos: string;
  mail?: string;
  curso?: string;
};

type AsignaturaResumen = {
  id: string;
  nombre: string;
  color: string | null;
  promedio: number | null;
  actividades: number;
  asistencias: number;
};

export default function AlumnoPage() {
  const rawParams = useParams();
  const router = useRouter();

  // Normaliza el parámetro desde la URL (tolera nombres antiguos de carpeta)
  const alumnoId = useMemo(() => {
    const p = rawParams as Record<string, string | undefined>;
    const v = p?.alumnoId ?? p?.alumnold ?? p?.id;
    return typeof v === "string" ? v : "";
  }, [rawParams]);

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [asignaturas, setAsignaturas] = useState<AsignaturaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const normalizeHex = (v?: string | null) => {
    if (!v) return "";
    let s = String(v).trim();
    if (!s) return "";
    if (!s.startsWith("#")) s = `#${s}`;
    if (s.length === 4) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    return s.toLowerCase();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        const api = (window as any)?.electronAPI;
        if (!alumnoId) {
          setErr("Alumno no encontrado (id=undefined)");
          return;
        }

        const asNum = Number(alumnoId);
        const idForIPC = Number.isNaN(asNum) ? alumnoId : asNum;

        const raw = (await api?.leerAlumno?.(idForIPC)) ?? null;
        if (!alive) return;

        if (!raw) {
          setErr(`Alumno no encontrado (id=${alumnoId})`);
          setAlumno(null);
          setAsignaturas([]);
          return;
        }

        setAlumno({
          id: String(raw.id ?? alumnoId),
          nombre: String(raw.nombre ?? raw.first_name ?? raw.name ?? ""),
          apellidos: String(
            raw.apellidos ??
              raw.apellido ??
              [raw.apellido1, raw.apellido2].filter(Boolean).join(" ")
          ),
          mail: raw.mail ?? raw.email ?? "",
          curso: raw.curso ?? raw.curso_id ?? raw.cursoAcronimo ?? undefined,
        });

        // 🔹 Cargar asignaturas + medias
        const list: AsignaturaResumen[] =
          (await api?.alumnoAsignaturasResumen?.(idForIPC)) ?? [];
        if (!alive) return;

        setAsignaturas(
          list.map((x) => ({
            ...x,
            color: normalizeHex(x.color || undefined) || null,
            promedio: x.promedio ?? null,
            actividades: x.actividades ?? 0,
            asistencias: x.asistencias ?? 0,
          }))
        );
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "No se pudo cargar el alumno");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [alumnoId]);

  const fullName = useMemo(() => {
    if (!alumno) return "";
    return `${alumno.apellidos}, ${alumno.nombre}`.trim();
  }, [alumno]);

  const mediaGlobal = useMemo(() => {
    const vals = asignaturas
      .map((a) => a.promedio)
      .filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2));
  }, [asignaturas]);

  const actividadesTotales = useMemo(
    () => asignaturas.reduce((acc, a) => acc + (a.actividades ?? 0), 0),
    [asignaturas]
  );

  if (loading)
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  if (err) return <div className="p-6 text-sm text-red-400">{err}</div>;
  if (!alumno) return null;

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-md border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
            aria-label="Volver"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              {alumno.curso && (
                <span className="uppercase">Curso: {alumno.curso}</span>
              )}
              {alumno.mail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {alumno.mail}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="">
        {/* Grid de cards cuadradas */}
        <div className="p-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
  {/* Tarjetas de asignaturas */}
  {asignaturas.map((a) => (
    <div
      key={a.id}
      className="relative rounded-lg p-4 aspect-square flex flex-col text-white border border-zinc-700"
      style={{
        background: a.color
          ? `linear-gradient(to top, ${a.color}80, #0a0a0a)`
          : "linear-gradient(to top, #333, #0a0a0a)",
      }}
      title={a.nombre}
    >
      {/* color dot */}
      <div
        className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full border border-white/20"
        style={{ backgroundColor: a.color || "#525252" }}
      />

      {/* nombre */}
      <div className="pr-6 tracking-wide">
        <div className="text-xl font-bold uppercase">{a.id}</div>
        <div className="text-xs uppercase line-clamp-3">{a.nombre}</div>
      </div>

      {/* footer métricas */}
      <div className="mt-auto pt-3">
        <div className="text-3xl font-bold tabular-nums">
          {a.promedio != null ? a.promedio.toFixed(2) : "—"}
        </div>
        <div className="text-[11px] text-zinc-200">
          {a.actividades ?? 0} act. · {a.asistencias ?? 0} asis.
        </div>
      </div>
    </div>
  ))}

  {/* Tarjeta de Media global (a la derecha, sin degradado) */}
  <div className="relative rounded-lg p-4 aspect-square flex flex-col text-white border border-zinc-700 bg-zinc-900">
    <div className="pr-6 tracking-wide">
      <div className="text-xs uppercase">media global</div>
    </div>

    <div className="mt-auto pt-3">
      <div className="text-3xl font-bold tabular-nums">
        {mediaGlobal != null ? mediaGlobal.toFixed(2) : "—"}
      </div>
    </div>
  </div>

  {asignaturas.length === 0 && (
    <div className="col-span-full text-sm text-zinc-400">
      Este alumno aún no tiene asignaturas o notas asociadas.
    </div>
  )}
</div>


      </section>

      {/* Métricas globales */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-900">
          <p className="text-xs text-zinc-400">Media global</p>
          <p className="text-2xl font-semibold">
            {mediaGlobal != null ? mediaGlobal.toFixed(2) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-900">
          <p className="text-xs text-zinc-400">Actividades realizadas</p>
          <p className="text-2xl font-semibold">{actividadesTotales}</p>
        </div>
      </section>

      {/* Asignaturas del alumno */}
    </main>
  );
}
