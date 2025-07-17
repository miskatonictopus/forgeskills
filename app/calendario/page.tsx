import MiCalendario from "@/components/Calendario"

export default function CalendarioPage() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold mb-4 text-white">📅 Calendario docente</h1>
      <MiCalendario />
    </main>
  )
}