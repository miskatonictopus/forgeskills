"use client";

import { useEffect, useState } from "react";

type CE = { id: string; codigo: string; descripcion: string };
type RA = { id: string; codigo: string; descripcion: string; ce: CE[] };

export function useRAyCE(asignaturaId: string | undefined) {
  const [raConCe, setRaConCe] = useState<RA[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!asignaturaId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        console.log("📦 Cargando RA y CE para:", asignaturaId);
        const raList = await window.electronAPI.obtenerRAPorAsignatura(asignaturaId);
        console.log("🔍 RA encontrados:", raList);
        const raConCE = await Promise.all(
          raList.map(async (ra: any) => {
            const ceList = await window.electronAPI.obtenerCEPorRA(ra.id);
            console.log(`  📚 CE para ${ra.codigo}:`, ceList);
            return { ...ra, ce: ceList };
          })
        );
        setRaConCe(raConCE);
      } catch (err) {
        console.error("Error al cargar RA y CE:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [asignaturaId]);

  return { raConCe, loading };
}
