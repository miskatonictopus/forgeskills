// layout.tsx

import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "sonner"
import type { Metadata } from "next"

const geist = localFont({
  src: [
    {
      path: "../fonts/Geist/Geist-VariableFont_wght.ttf",
      weight: "100 900",
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
      weight: "100 900",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${notoJp.variable} dark`}>
  <body className="bg-background text-foreground font-geist">
        {children}
        <Toaster />
      </body>
    </html>
  )
}