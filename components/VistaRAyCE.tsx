"use client";

import { useRAyCE } from "@/hooks/useRAyCE";

type Props = {
  asignaturaId: string;
};

export function VistaRAyCE({ asignaturaId }: Props) {
  const { raConCe, loading } = useRAyCE(asignaturaId);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando RA y CE...</p>;

  return (
    <div className="space-y-4">
      {raConCe.map((ra) => (
        <div key={ra.id} className="border rounded-lg p-4 shadow-sm bg-muted/20">
          <h3 className="font-semibold text-lg mb-2">
            {ra.codigo} — {ra.descripcion}
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {ra.ce.map((ce) => (
              <li key={ce.id}>
                <strong>{ce.codigo}</strong>: {ce.descripcion}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
