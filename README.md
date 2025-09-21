# 🧭 Guía de Rutas y Estructura - Proyecto Electron + Next.js

Esta guía documenta la estructura oficial y definitiva para el desarrollo con Electron + Next.js + SQLite en este proyecto. Sigue esta estructura para evitar errores de rutas, conflictos de compilación o confusión entre entornos.

---

## 📁 Estructura de Carpetas

```
.
├── electron/                 ← Código fuente TypeScript para Electron
│   ├── main.ts             ← Proceso principal
│   ├── preload.ts          ← API expuesta al frontend
│   └── database.ts         ← Inicialización de SQLite
├── data/
│   └── db.sqlite           ← Base de datos persistente
├── dist-electron/            ← Salida de compilación JS
│   └── electron/
│       ├── main.js
│       ├── preload.js
│       └── database.js
```

---

## ⚙️ tsconfig.electron.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist-electron",
    "rootDir": "./",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["electron/**/*", "models/**/*"]
}
```

---

## 🔌 Referencias en main.ts (correctas)

```ts
webPreferences: {
  preload: path.join(__dirname, "electron/preload.js"),
  nodeIntegration: false,
  contextIsolation: true,
}
```

> \_\_dirname en tiempo de ejecución apunta a `dist-electron/`, por eso esta ruta es válida.

---

## 📦 package.json

```json
{
  "main": "dist-electron/electron/main.js",
  "scripts": {
    "compile:electron": "tsc -p tsconfig.electron.json",
    "launch:electron": "electron .",
    "dev:electron": "concurrently -k -n \"NEXT,ELECTRON\" -c \"cyan,green\" \"next dev\" \"wait-on http://localhost:3000 && electron .\""
  }
}
```

---

## ✅ Buenas prácticas

* Compila siempre antes de lanzar Electron:

  ```bash
  npm run compile:electron && npm run dev:electron
  ```

* Nunca referencies archivos `.ts` desde Electron: usa los `.js` compilados.

* Nunca modifiques directamente nada dentro de `dist-electron/`.

* Si tienes dudas sobre la ruta de un archivo, imprime `__dirname` y mira dónde está el `main.js`.

---

> Esta guía es obligatoria para futuros desarrolladores. Evita retrocesos innecesarios y asegura estabilidad.

<a href="https://lordicon.com/">Icons by Lordicon.com</a>