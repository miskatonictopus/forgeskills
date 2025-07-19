// components/EventoConNotas.tsx
"use client"

import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

type Props = {
  id: string;
  title: string;
  timeText: string;
  color: string;
  clave: string;
};

export function EventoConNotas({ id, title, timeText, color, clave }: Props) {
  const [nota, setNota] = useState("");

  return (
    <div
      className="flex flex-col w-full h-full px-2 py-1 text-sm font-medium text-white rounded gap-1 overflow-hidden"
      style={{ backgroundColor: color }}
    >
      <div className="truncate">
        <span className="font-bold">{timeText}</span> –{" "}
        <span className="uppercase font-bold text-xs">{title}</span>
      </div>

      <Textarea
        placeholder="Escribe notas..."
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 resize-none h-full min-h-[60px] text-xs text-white bg-white/10 placeholder:text-white/50"
      />
    </div>
  );
}