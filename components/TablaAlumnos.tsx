"use client";

import Link from "next/link";
import { crearSlugAlumno } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, User } from "lucide-react";

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

export default function TablaAlumnos({
  filtro,
  onEmptyChange,
  refreshKey,
}: Props) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  useEffect(() => {
    const cargarAlumnos = async () => {
      const datos = await window.electronAPI.leerAlumnos();
      setAlumnos(datos);
      onEmptyChange?.(datos.length === 0);
    };
    cargarAlumnos();
  }, [refreshKey]);

  const alumnosFiltrados = alumnos.filter((alumno) =>
    `${alumno.nombre} ${alumno.apellidos}`
      .toLowerCase()
      .includes(filtro.toLowerCase())
  );

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (seleccionados.length === alumnosFiltrados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(alumnosFiltrados.map((a) => a.id));
    }
  };

  // ✅ Mostrar mensaje si no hay alumnos
  if (alumnos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-6">
        <img
          src="/images/DKke.gif"
          alt="Sin alumnos"
          className="w-24 h-24 mb-4"
        />
        <p className="text-sm">No hay alumnos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="mt-0">
      <div className="border border-zinc-800 rounded-xl overflow-auto bg-zinc-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
            <TableHead></TableHead>
              <TableHead className="text-xs">Alumno</TableHead>
              <TableHead className="text-xs">Curso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alumnosFiltrados.map((alumno) => (
              <TableRow key={alumno.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        console.log("Ver estadísticas de", alumno.nombre)
                      }
                      className="text-muted-foreground hover:text-white transition"
                    >
                      <User className="h-4 w-4" />
                    </button>
                    {/* <img
                      src={`/avatars/avatar${(alumno.id % 5) + 1}.png`}
                      alt={`Avatar de ${alumno.nombre}`}
                      className="w-8 h-8 rounded-full object-cover shadow"
                    /> */}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-white leading-tight">
                  <Link
                    href={`/alumnos/${crearSlugAlumno(
                      alumno.nombre,
                      alumno.apellidos
                    )}`}
                    className="block hover:underline"
                  >
                    <span className=" text-white text-xs">
                      {`${alumno.apellidos}, ${alumno.nombre}`}
                    </span>
                    <br />
                    <span className="text-muted-foreground text-xs">
                      {alumno.mail}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="uppercase text-xs">{alumno.curso}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
