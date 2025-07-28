// app/not-found.tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Ghost } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-4 text-center font-notojp">
        <img
    src="/images/logo-white.png"
    alt="SkillForge Logo"
    className="w-40 h-40 object-contain"
  />
      <h1 className="text-6xl font-light bg-gradient-to-r from-stone-100 to-stone-200 bg-clip-text text-transparent">
  error de flow*
</h1>
      <p className="text-4xl font-light bg-gradient-to-r from-stone-200 to-stone-300 bg-clip-text text-transparent mt-3">Lo sentimos, esto que estas viendo</p>
      <p className="text-4xl font-light bg-gradient-to-r from-stone-100 to-stone-300 bg-clip-text text-transparent mt-3">es un resquicio de nuestra versión alfa</p>
      <p className="text-1xl font-light bg-gradient-to-r from-stone-100 to-stone-300 bg-clip-text text-transparent mt-3">*(Sign: se conoce como error de flow lo que suele ser un error de flow )</p>
      <Button asChild className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
