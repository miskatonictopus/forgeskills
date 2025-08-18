import { cn } from "@/lib/utils"

type DotProps = {
  color: string
  className?: string
}

export function Dot({ color, className }: DotProps) {
  return (
    <span
      style={{ backgroundColor: color }}
      className={cn("inline-block w-3 h-3 rounded-full", className)}
    />
  )
}