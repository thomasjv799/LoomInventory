import { authServer } from "@/lib/auth-server";
export async function GET(request: Request) {
  try {
    return await authServer().handler.GET(request);
  } catch {
    return Response.json(
      { error: "Authentication is not configured" },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    return await authServer().handler.POST(request);
  } catch {
    return Response.json(
      { error: "Authentication is unavailable" },
      { status: 503 },
    );
  }
}
