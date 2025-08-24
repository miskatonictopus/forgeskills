import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
      },
      fontFamily: {
        geist: ["var(--font-geist)"],
        notojp: ["var(--font-notojp)"],
      },
      screens: { xxxl: "1570px" },
      keyframes: {
        "fade-in": { "0%": { opacity: 0, transform: "translateY(-10px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      animation: { "fade-in": "fade-in 0.5s ease-out" },
    },
  },
  plugins: [require("@tailwindcss/line-clamp"), require("@tailwindcss/typography")],
}

export default config
