import { NextResponse, type NextRequest } from "next/server";

import { rateLimit } from "@/lib/ratelimit";
import { updateSession } from "@/lib/supabase/middleware";

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function apiLimit(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api/")) return null;

  const method = request.method.toUpperCase();
  const key = clientKey(request);
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isExport =
    method === "GET" &&
    (path === "/api/reports/management" ||
      /^\/api\/containers\/[^/]+\/documents\/zip$/.test(path) ||
      /^\/api\/documents\/[^/]+\/file$/.test(path));

  if (path === "/api/import" && method === "POST") {
    return { bucket: `import:${key}`, limit: 5, windowMs: 60_000 };
  }
  if (path === "/api/documents" && method === "POST") {
    return { bucket: `upload:${key}`, limit: 30, windowMs: 10 * 60_000 };
  }
  if (isExport) {
    return { bucket: `export:${key}`, limit: 40, windowMs: 10 * 60_000 };
  }
  if (isMutation) {
    return { bucket: `mutation:${key}`, limit: 120, windowMs: 60_000 };
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const limit = apiLimit(request);
  if (limit) {
    const result = rateLimit(limit.bucket, limit.limit, limit.windowMs);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Too many requests. Retry in ${result.retryAfter}s.` },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfter) },
        }
      );
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon
     * - public asset files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
