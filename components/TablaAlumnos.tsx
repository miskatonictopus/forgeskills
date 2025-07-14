"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, BarChart3 } from "lucide-react";

type Alumno = {
  id: number;
  nombre: string;
  apellidos: string;
  curso: string;
  mail: string;
};

export default function TablaAlumnos() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [filtro, setFiltro] = useState("");
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  useEffect(() => {
    const cargarAlumnos = async () => {
      const datos = await window.electronAPI.leerAlumnos();
      setAlumnos(datos);
    };
    cargarAlumnos();
  }, []);

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

  return (
    <div className="mt-0">
      {/* 🔤 Título + Buscador */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-notojp font-light tracking-tight">
          Mis Alumnos
        </h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre o apellidos..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-10 bg-zinc-800 text-white placeholder-zinc-400"
          />
        </div>
      </div>

      {/* 📋 Tabla */}
      <div className="border border-zinc-800 rounded-xl overflow-auto bg-zinc-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">
                <div className="flex items-center gap-4">
                  <BarChart3 className="invisible h-4 w-4" />
                  <Checkbox
                    checked={
                      seleccionados.length === alumnosFiltrados.length &&
                      alumnosFiltrados.length > 0
                    }
                    onCheckedChange={toggleTodos}
                    aria-label="Seleccionar todos"
                  />
                </div>
              </TableHead>
              <TableHead>Apellidos</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Correo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alumnosFiltrados.map((alumno) => (
              <TableRow key={alumno.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {/* 📊 Botón de estadísticas */}
                    <button
                      onClick={() =>
                        console.log("Ver estadísticas de", alumno.nombre)
                      }
                      className="text-muted-foreground hover:text-white transition"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>

                    {/* 🖼️ Avatar */}
                    <img
                      src={`/avatars/avatar${(alumno.id % 5) + 1}.png`}
                      alt={`Avatar de ${alumno.nombre}`}
                      className="w-8 h-8 rounded-full object-cover shadow"
                    />

                    {/* ✅ Checkbox */}  
                    <Checkbox
                      checked={seleccionados.includes(alumno.id)}
                      onCheckedChange={() => toggleSeleccion(alumno.id)}
                      aria-label={`Seleccionar ${alumno.nombre}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="uppercase">{alumno.apellidos}</TableCell>
                <TableCell className="uppercase">{alumno.nombre}</TableCell>
                <TableCell className="uppercase">{alumno.curso}</TableCell>
                <TableCell>{alumno.mail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
