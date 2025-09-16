"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { crearSlugAlumno } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User } from "lucide-react";

type Props = {
  filtro: string;
  onEmptyChange?: (isEmpty: boolean) => void;
  refreshKey?: number;
};

type Alumno = {
  id: number;
  nombre: string;
  apellidos: string;
  curso: string;
  mail: string;
};

type SortKey = "nombre" | "curso";
type SortConfig = { key: SortKey; direction: "asc" | "desc" };

export default function TablaAlumnos({
  filtro,
  onEmptyChange,
  refreshKey,
}: Props) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "nombre",
    direction: "asc",
  });

  // Carga de alumnos
  useEffect(() => {
    let cancel = false;
    const cargarAlumnos = async () => {
      try {
        setCargando(true);
        const api = (window as any)?.electronAPI;
        const datos: Alumno[] = (await api?.leerAlumnos?.()) ?? [];
        if (!cancel) {
          setAlumnos(Array.isArray(datos) ? datos : []);
          onEmptyChange?.((datos ?? []).length === 0);
        }
      } catch (err) {
        console.error("Error leyendo alumnos:", err);
        if (!cancel) {
          setAlumnos([]);
          onEmptyChange?.(true);
        }
      } finally {
        if (!cancel) setCargando(false);
      }
    };
    cargarAlumnos();
    return () => {
      cancel = true;
    };
  }, [refreshKey, onEmptyChange]);

  // Normalizador para búsqueda sin acentos y case-insensitive
  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

 const router = useRouter();

  const alumnosFiltrados = useMemo(() => {
    const f = norm(filtro);
    if (!f) return alumnos;
    return alumnos.filter((alumno) =>
      norm(`${alumno.nombre} ${alumno.apellidos}`).includes(f)
    );
  }, [alumnos, filtro]);

  // Ordenación
  const alumnosOrdenados = useMemo(() => {
    const sorted = [...alumnosFiltrados];
    sorted.sort((a, b) => {
      let aVal = "";
      let bVal = "";

      if (sortConfig.key === "nombre") {
        aVal = `${a.apellidos} ${a.nombre}`;
        bVal = `${b.apellidos} ${b.nombre}`;
      } else if (sortConfig.key === "curso") {
        aVal = a.curso;
        bVal = b.curso;
      }

      const comp = norm(aVal).localeCompare(norm(bVal));
      return sortConfig.direction === "asc" ? comp : -comp;
    });
    return sorted;
  }, [alumnosFiltrados, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // Estados vacíos
  if (cargando && alumnos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-6">
        <p className="text-sm">Cargando alumnos…</p>
      </div>
    );
  }

  if (alumnos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-6">
        <img src="/images/DKke.gif" alt="Sin alumnos" className="w-24 h-24 mb-4" />
        <p className="text-sm">No hay alumnos disponibles.</p>
      </div>
    );
  }

  if (alumnosFiltrados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-6">
        <img src="/images/DKke.gif" alt="Sin resultados" className="w-24 h-24 mb-4" />
        <p className="text-sm">
          No hay alumnos que coincidan con “{filtro}”.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-0">
      <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead
                className="text-xs cursor-pointer select-none"
                onClick={() => toggleSort("nombre")}
              >
                Alumno{" "}
                {sortConfig.key === "nombre" &&
                  (sortConfig.direction === "asc" ? "▲" : "▼")}
              </TableHead>
              <TableHead
                className="text-xs cursor-pointer select-none"
                onClick={() => toggleSort("curso")}
              >
                Curso{" "}
                {sortConfig.key === "curso" &&
                  (sortConfig.direction === "asc" ? "▲" : "▼")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alumnosOrdenados.map((alumno) => (
              <TableRow key={alumno.id}>
                <TableCell>
  <div className="flex items-center gap-3">
    <button
      onClick={() => router.push(`/alumnos/${alumno.id}`)}
      className="text-muted-foreground hover:text-white transition"
    >
      <User className="h-4 w-4" />
    </button>
  </div>
</TableCell>


                <TableCell className="text-xs text-white leading-tight">
                <Link href={`/alumnos/${alumno.id}`} className="block hover:underline">
    <span className="text-white text-xs">
      {`${alumno.apellidos}, ${alumno.nombre}`}
    </span>
    <br />
    <span className="text-muted-foreground text-xs">
      {alumno.mail}
    </span>
  </Link>
</TableCell>

                <TableCell className="uppercase text-xs">
                  {alumno.curso}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
