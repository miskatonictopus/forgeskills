// app/layout.tsx
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeSmoothTransition from "@/components/theme-smooth-transition";

const geist = localFont({
  src: [
    { path: "../fonts/Geist/Geist-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/Geist/Geist-Regular.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-geist",
  display: "swap",
});

const notoJp = localFont({
  src: [{ path: "../fonts/NotoJp/NotoSerifJP-VariableFont_wght.ttf", weight: "100 900", style: "normal" }],
  variable: "--font-notojp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CONTROL V-1",
  description: "Sistema de gestión de asignaturas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geist.variable} ${notoJp.variable}`}>
      <body className="bg-background text-foreground font-geist">
        <ThemeProvider>
          <ThemeSmoothTransition duration={0.38} minOpacity={0.64}>
            {children}
            <Toaster />
          </ThemeSmoothTransition>
        </ThemeProvider>
      </body>
    </html>
  );
}
