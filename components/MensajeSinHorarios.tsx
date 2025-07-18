import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function MensajeSinHorarios() {
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimar(true);
      setTimeout(() => setAnimar(false), 1000);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <p
className={cn(
        "flex items-center gap-2 text-xs text-red-200 uppercase mt-2 transition-all",
        animar && "animate-bounce ease-in-out text-red-200"
      )}
    >
      <Clock className="w-3.5 h-3.5" />
      Sin horarios asignados
    </p>
  );
}
