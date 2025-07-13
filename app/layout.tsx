// layout.tsx

import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "sonner"
import type { Metadata } from "next"

const geist = localFont({
  src: [
    {
      path: "../fonts/Geist/Geist-VariableFont_wght.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-geist",
  display: "swap",
})

const notoJp = localFont({
  src: [
    {
      path: "../fonts/NotoJp/NotoSerifJP-VariableFont_wght.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-notojp",
  display: "swap",
})


export const metadata: Metadata = {
  title: "CONTROL V-1",
  description: "Sistema de gestión de asignaturas",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${geist.variable} ${notoJp.variable} antialiased font-sans bg-zinc-950 text-white`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton duration={4000} />
      </body>
    </html>
  )
}
