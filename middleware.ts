// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Protege si ACTIVADA y estamos en producción (o si fuerzas con AUTH_FORCE)
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true"
const IS_PROD =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
const AUTH_USER = process.env.AUTH_USER || ""
const AUTH_PASS = process.env.AUTH_PASS || ""

// Rutas que NO queremos proteger (añade o quita según tu caso)
const WHITELIST = [
  /^\/api\/health$/,      // healthcheck
  /^\/_next\/static\//,   // assets Next
  /^\/_next\/image\//,    // imágenes optimizadas
  /^\/favicon\.ico$/,     // favicon
]

function isWhitelisted(pathname: string) {
  return WHITELIST.some((re) => re.test(pathname))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!AUTH_ENABLED || !IS_PROD) {
    return NextResponse.next()
  }
  if (isWhitelisted(pathname)) {
    return NextResponse.next()
  }

  const auth = req.headers.get("authorization")
  const expected = "Basic " + Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString("base64")

  if (auth === expected) return NextResponse.next()

  const res = new NextResponse("Authentication required", { status: 401 })
  res.headers.set("WWW-Authenticate", 'Basic realm="Protected"')
  return res
}

// Aplica a todo salvo lo estático/ico (el whitelist vuelve a filtrar /api/health)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
