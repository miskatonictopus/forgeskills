// components/MensajeSinHorarios.tsx
import { useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick?: () => void;
  className?: string;
};

export function MensajeSinHorarios({ onClick, className }: Props) {
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimar(true);
      setTimeout(() => setAnimar(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      aria-label="Añadir horario"
      className={cn(
        "flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-md bg-white text-black hover:bg-gray-100 transition-all font-medium"
      )}
    >
      <PlusCircle className="w-4 h-4" />
      Añadir horario
    </button>
  );
}