"use client";

import { useState, useEffect } from "react";
import React from "react";

type Alumno = {
  id: string;
  nombre: string;
  apellidos: string;
};

type CE = {
  codigo: string;
  descripcion: string;
};

type RA = {
  codigo: string;
  descripcion: string;
  CE: CE[];
};

type Props = {
  alumnos: Alumno[];
  ra: RA[];
};

function getNotaColor(nota: string | number) {
  const valor = parseFloat(nota.toString());
  if (isNaN(valor)) return "text-muted-foreground";
  if (valor < 5) return "text-red-600 dark:text-red-400";
  if (valor < 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export default function TablaNotasCEAlumnos({ alumnos, ra }: Props) {
  const [notas, setNotas] = useState<Record<string, Record<string, string[]>>>({});
  const [notasRA, setNotasRA] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const nuevasNotas: Record<string, Record<string, string[]>> = {};
    ra.forEach((raItem) => {
      raItem.CE.forEach((ce) => {
        if (!nuevasNotas[ce.codigo]) nuevasNotas[ce.codigo] = {};
        alumnos.forEach((alumno) => {
          if (!nuevasNotas[ce.codigo][alumno.id]) {
            nuevasNotas[ce.codigo][alumno.id] = ["", ""];
          }
        });
      });
    });
    setNotas(nuevasNotas);
  }, [ra, alumnos]);

  useEffect(() => {
    const nuevasNotasRA: Record<string, Record<string, string>> = {};
    ra.forEach((raItem) => {
      nuevasNotasRA[raItem.codigo] = {};
      alumnos.forEach((alumno) => {
        const mediasCE = raItem.CE.map((ce) =>
          mediaNotasCE(ce.codigo, alumno.id)
        ).filter((n) => !isNaN(n));
        const media =
          mediasCE.length > 0
            ? (mediasCE.reduce((a, b) => a + b, 0) / mediasCE.length).toFixed(1)
            : "";
        nuevasNotasRA[raItem.codigo][alumno.id] = media;
      });
    });
    setNotasRA(nuevasNotasRA);
  }, [notas, ra, alumnos]);

  const handleNotaParcialChange = (
    ceCodigo: string,
    alumnoId: string,
    index: number,
    valor: string
  ) => {
    setNotas((prev) => {
      const prevNotas = [...(prev[ceCodigo]?.[alumnoId] || [])];
      prevNotas[index] = valor;
      return {
        ...prev,
        [ceCodigo]: {
          ...prev[ceCodigo],
          [alumnoId]: prevNotas,
        },
      };
    });
  };

  const mediaNotasCE = (ceCodigo: string, alumnoId: string): number => {
    const notasParciales = notas[ceCodigo]?.[alumnoId] || [];

    const valores = notasParciales
      .map((n) => parseFloat(n.replace(",", ".")))
      .filter((n) => !isNaN(n));
    if (valores.length === 0) return 0;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  };

  return (
    <div className="overflow-auto max-h-[75vh] border rounded-xl shadow">
      <table className="min-w-max table-auto text-sm">
        <thead className="bg-muted/50">
          <tr className="sticky top-0 z-10 bg-muted border-b border-muted">
            <th className="sticky left-0 bg-muted px-4 py-2 font-medium text-left border-r border-muted">
              CE / RA / Alumno
            </th>
            {alumnos.map((a, index) => (
              <th
                key={a.id}
                className={`px-4 py-2 font-medium text-left whitespace-nowrap ${
                  index !== 0 ? "border-l border-white/10" : ""
                }`}
              >
                {a.apellidos}, {a.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ra.map((raItem) => (
            <React.Fragment key={`ra-${raItem.codigo}`}>
              <tr className="bg-muted/10 border-t">
                <td className="sticky left-0 bg-background font-semibold px-4 py-2 border-r border-muted w-125 whitespace-normal break-words">
                  {raItem.codigo} – {raItem.descripcion}
                </td>
                {alumnos.map((alumno, index) => (
                <td
                key={alumno.id}
                className={`px-2 py-1 ${index !== 0 ? "border-l border-white/10" : ""}`}
              >
                <div className="w-full h-full m-[2px]">
                  <div
                    className="w-full h-full rounded bg-white text-center text-2xl font-bold text-black shadow-sm"
                  >
                    {notasRA[raItem.codigo]?.[alumno.id] || "-"}
                  </div>
                </div>
              </td>
              
               
                ))}
              </tr>
              {raItem.CE.map((ce) => (
                <tr key={ce.codigo} className="border-t">
                  <td className="sticky left-0 bg-background px-4 py-2 text-muted-foreground border-r border-muted w-72 whitespace-normal break-words">
                    {ce.codigo} – {ce.descripcion}
                  </td>
                  {alumnos.map((alumno, index) => {
                    const notasParciales = notas[ce.codigo]?.[alumno.id] || [];
                    return (
                      <td
                        key={alumno.id}
                        className={`px-2 py-1 ${
                          index !== 0 ? "border-l border-white/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <div className="flex gap-1">
                            {notasParciales.map((nota, i) => (
                              <input
                                key={i}
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={nota}
                                className="w-10 text-sm text-center border rounded"
                                onChange={(e) =>
                                  handleNotaParcialChange(
                                    ce.codigo,
                                    alumno.id,
                                    i,
                                    e.target.value.replace(",", ".")
                                  )
                                }
                              />
                            ))}
                          </div>
                          <input
                            type="number"
                            value={mediaNotasCE(ce.codigo, alumno.id).toFixed(1)}
                            className={`w-10 text-sm text-center border rounded bg-muted cursor-not-allowed ${getNotaColor(
                              mediaNotasCE(ce.codigo, alumno.id)
                            )}`}
                            readOnly
                            tabIndex={-1}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
