import { authServer } from "@/lib/auth-server";
async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    if (request.method !== "GET") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== new URL(request.url).origin)
        return Response.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Cross-origin writes are blocked",
            },
          },
          { status: 403 },
        );
    }
    const token = await authServer().getToken();
    if (!token)
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 },
      );
    const { path } = await params;
    if (
      path.some(
        (p) => p === ".." || p === "." || p.includes("/") || p.includes("\\"),
      )
    )
      return Response.json(
        { error: { code: "INVALID_INPUT" } },
        { status: 422 },
      );
    const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!site) throw new Error("Missing backend");
    const url = new URL(
      "/api/v1/" +
        path.map(encodeURIComponent).join("/") +
        new URL(request.url).search,
      site,
    );
    const result = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      redirect: "error",
    });
    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type":
          result.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "UNAVAILABLE",
          message: "Backend is unavailable or not configured",
        },
      },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
