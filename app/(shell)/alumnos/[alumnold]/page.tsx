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
  color?: string;
  promedio?: number;
  actividades?: number;
  asistencias?: number;
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

        // Si es numérico, pásalo como número; si no, como string
        const asNum = Number(alumnoId);
        const idForIPC = Number.isNaN(asNum) ? alumnoId : asNum;

        console.log("[AlumnoPage] leerAlumno()", {
          alumnoId,
          idForIPC,
          apiKeys: Object.keys(api ?? {}),
        });

        const raw =
          (await api?.leerAlumno?.(idForIPC)) ??
          null;

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

        // Si más adelante cargas asignaturas, usa aquí tus handlers:
        // const list = await api?.asignaturasDeAlumno?.(raw.id);
        // setAsignaturas( ...map a AsignaturaResumen y normaliza color con normalizeHex(...) );
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

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
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
              {alumno.curso && <span className="uppercase">Curso: {alumno.curso}</span>}
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

      {/* Métricas globales (placeholder) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-900">
          <p className="text-xs text-zinc-400">Asistencia global</p>
          <p className="text-2xl font-semibold">—</p>
        </div>
        <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-900">
          <p className="text-xs text-zinc-400">Media global</p>
          <p className="text-2xl font-semibold">—</p>
        </div>
        <div className="rounded-lg border border-zinc-700 p-4 bg-zinc-900">
          <p className="text-xs text-zinc-400">Actividades realizadas</p>
          <p className="text-2xl font-semibold">—</p>
        </div>
      </section>

      {/* Asignaturas del alumno */}
      <section className="rounded-lg border border-zinc-700 bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Asignaturas ({asignaturas.length})
          </p>
        </div>
        <ul className="p-2 divide-y divide-zinc-800">
          {asignaturas.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-2 py-3">
              <span
                className={`h-3 w-3 rounded-full border ${
                  a.color ? "border-white/20" : "border-zinc-600"
                }`}
                style={{ backgroundColor: a.color || "transparent" }}
                title={a.color || "Sin color"}
              />
              <div className="flex-1">
                <p className="text-sm">{a.nombre}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
