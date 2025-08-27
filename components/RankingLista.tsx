"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, Trophy, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RankingItem = {
  id: string;
  nombre: string;
  media: number;
  extra?: string;
};

type Orden = "mejores" | "peores";

interface RankingListaProps {
  titulo?: string;
  subtitulo?: string;
  items: RankingItem[];
  cantidad?: number;
  orden?: Orden;
  isLoading?: boolean;
  className?: string;
  showBadges?: boolean;
  getHref?: (item: RankingItem) => string | undefined;
  formatScore?: (n: number) => string;
}

export default function RankingLista({
  titulo = "Ranking",
  subtitulo,
  items,
  cantidad = 3,
  orden = "mejores",
  isLoading = false,
  className,
  showBadges = true,
  getHref,
  formatScore = (n) => n.toFixed(2),
}: RankingListaProps) {
  const lista = useMemo(() => {
    if (!items?.length) return [];
    const sorted = [...items].sort((a, b) =>
      orden === "mejores" ? b.media - a.media : a.media - b.media
    );
    return sorted.slice(0, Math.max(0, cantidad));
  }, [items, cantidad, orden]);

  const colorClass = orden === "mejores" ? "text-emerald-300" : "text-white";

  return (
    <div className={cn("w-full", className)}>
      {/* ====== Título ====== */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {orden === "mejores" ? (
            <Trophy className="h-4 w-4 opacity-80" />
          ) : (
            <ArrowDownWideNarrow className="h-4 w-4 opacity-80" />
          )}
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            {titulo}
          </h2>
        </div>
        {subtitulo ? (
          <span className="text-xs text-muted-foreground">{subtitulo}</span>
        ) : null}
      </div>

      {/* ====== Tabla ====== */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando clasificaciones…
        </div>
      ) : !lista.length ? (
        <div className="text-sm text-muted-foreground">No hay datos disponibles</div>
      ) : (
        <div className="rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[56px] text-center">#</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead className="hidden md:table-cell">Extra</TableHead>
                <TableHead className="text-right">Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {lista.map((alumno, index) => {
                const rank = index + 1;
                const href = getHref?.(alumno);

                const nombreCell = href ? (
                  <Link
                    href={href}
                    className={cn("font-medium hover:underline truncate block", colorClass)}
                    title={alumno.nombre}
                  >
                    {alumno.nombre}
                  </Link>
                ) : (
                  <span
                    className={cn("font-medium truncate block", colorClass)}
                    title={alumno.nombre}
                  >
                    {alumno.nombre}
                  </span>
                );

                return (
                  <TableRow key={alumno.id}>
                    <TableCell className="text-center tabular-nums">
                      {showBadges ? <RankBadge orden={orden} rank={rank} /> : rank}
                    </TableCell>
                    <TableCell className="max-w-[260px]">{nombreCell}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {alumno.extra ?? "—"}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", colorClass)}>
                      {formatScore(alumno.media)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank, orden }: { rank: number; orden: Orden }) {
  if (orden === "peores") {
    // badge neutro para "últimos"
    return (
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] leading-none text-muted-foreground">
        {rank}
      </span>
    );
  }
  const label = rank === 1 ? "①" : rank === 2 ? "②" : rank === 3 ? "③" : String(rank);
  return (
    <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px] leading-none font-semibold">
      {label}
    </Badge>
  );
}
