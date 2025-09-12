"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // tamaño y borde
      "peer h-4 w-4 shrink-0 rounded-[4px] border border-zinc-600 bg-transparent",
      // accesibilidad
      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // disabled
      "disabled:cursor-not-allowed disabled:opacity-50",
      // estados — fondo y color del icono (el tick)
      "data-[state=checked]:bg-white data-[state=indeterminate]:bg-white",
      "data-[state=checked]:text-black data-[state=indeterminate]:text-black",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3.5 w-3.5" />
      {/* Si usas estado indeterminate, puedes mostrar el guion: */}
      {/* <Minus className="h-3.5 w-3.5" /> */}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
