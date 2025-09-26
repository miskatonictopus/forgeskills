import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  // Solo aplicar en entornos Preview
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.next()
  }

  const authHeader = req.headers.get("authorization")
  if (!authHeader) {
    return new Response("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
    })
  }

  const base64 = authHeader.split(" ")[1] || ""
  const [user, pass] = Buffer.from(base64, "base64").toString().split(":")

  if (
    user === process.env.PREVIEW_USER &&
    pass === process.env.PREVIEW_PASS
  ) {
    return NextResponse.next()
  }

  return new Response("Invalid credentials", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Preview"' },
  })
}

// Aplica el middleware a todas las rutas (puedes restringir si quieres)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
