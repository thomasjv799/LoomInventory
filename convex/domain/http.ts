import { ConvexError } from "convex/values";
export function errorResponse(error: unknown, requestId: string): Response {
  const data = error instanceof ConvexError ? error.data : null;
  const code =
    data && typeof data === "object" && "code" in data
      ? String(data.code)
      : error instanceof SyntaxError ||
          (error instanceof Error &&
            /ArgumentValidationError|INVALID_INPUT/.test(error.message))
        ? "INVALID_INPUT"
        : "INTERNAL_ERROR";
  const status =
    (
      {
        UNAUTHENTICATED: 401,
        FORBIDDEN: 403,
        INVALID_INPUT: 422,
        NOT_FOUND: 404,
        CONFLICT: 409,
        INSUFFICIENT_STOCK: 409,
      } as Record<string, number>
    )[code] ?? 500;
  const message =
    data && typeof data === "object" && "message" in data
      ? String(data.message)
      : status === 422
        ? "Invalid request input"
        : "Request could not be completed";
  return Response.json(
    { error: { code, message }, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
