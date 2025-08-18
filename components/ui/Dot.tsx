"use client"

export function Dot({ color }: { color: string }) {
  return (
    <span className="relative inline-block align-middle mr-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="absolute inset-0 rounded-full ring-2 ring-background" />
    </span>
  )
}