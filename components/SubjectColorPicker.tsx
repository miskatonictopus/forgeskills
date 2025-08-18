// ColorSelector.tsx
"use client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

type Props = {
  colorActual: string;
  onSelect: (hex: string) => void; // guarda + cierra lo maneja el padre
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
};

const PALETTE = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#06b6d4",
  "#3b82f6","#6366f1","#a855f7","#ec4899","#f43f5e","#14b8a6","#0ea5e9","#22c55e",
  "#4ade80","#a3e635","#d1d5db","#9ca3af","#4b5563","#111827","#ffffff"
];

export function ColorSelector({ colorActual, onSelect, open, onOpenChange }: Props) {
  const [hex, setHex] = useState(colorActual || "#4b5563");
  useEffect(() => setHex(colorActual || "#4b5563"), [colorActual]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Usa tu trigger actual fuera si lo prefieres */}
      <PopoverTrigger asChild>
        <button
          className="h-4 w-4 rounded-full ring-1 ring-zinc-700"
          style={{ backgroundColor: hex }}
          aria-label="Abrir selector de color"
        />
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Color de la asignatura</p>
          <button
            aria-label="Cerrar"
            className="p-1 rounded hover:bg-muted"
            onClick={() => onOpenChange?.(false)} // 👈 solo cierra, no resetea
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              className="h-6 w-6 rounded-full ring-1 ring-black/20"
              style={{ backgroundColor: c }}
              onClick={() => {
                setHex(c);
                onSelect(c);          // 👈 aplica/guarda inmediatamente
                onOpenChange?.(false); // 👈 y cierra el popover
              }}
              aria-label={`Elegir ${c}`}
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            className="flex-1 h-9 rounded border bg-background px-2 text-sm"
            placeholder="#4b5563"
          />
          <Button
            onClick={() => {
              onSelect(hex);          // 👈 también se puede aplicar manualmente
              onOpenChange?.(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
