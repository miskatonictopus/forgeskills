#!/bin/bash

echo "🧹 Limpiando cachés y restos de compilación..."

# Borrar carpeta .next de Next.js
rm -rf .next

# Borrar caché de Vite (si usas Vite con Electron o build-tools modernos)
rm -rf node_modules/.vite

# Borrar node_modules y package-lock.json
rm -rf node_modules package-lock.json

# Limpiar caché de npm
npm cache clean --force

# Borrar caché de Electron (ajusta el nombre si tu app tiene otro)
rm -rf ~/Library/Application\ Support/SkillForge

echo "✅ Limpieza completada. Ahora ejecuta 'npm install' para reinstalar dependencias."
