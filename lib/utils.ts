import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import slugify from "slugify"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const crearSlugAlumno = (nombre: string, apellidos: string) =>
  slugify(`${apellidos}_${nombre}`, { lower: true, strict: true })

