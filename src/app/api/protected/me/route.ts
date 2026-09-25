export const runtime = "nodejs";

type MeData = Readonly<{
  id: string;
  email: string | null;
  phone: string | null;
}>;

export async function GET(request: Request): Promise<Response> {
  const { executeRoute } = await import("@/lib/http/execute-route");
  const { successResponse, corsHeaders } = await import("@/lib/http/response");

  return executeRoute(request, async () => {
    const { authenticateRequest } = await import("@/auth/authenticate-request");
    const auth = await authenticateRequest(request);
    const headers = corsHeaders(request);
    headers.set("Cache-Control", "no-store");

    return successResponse<MeData>(
      { id: auth.userId, email: auth.email, phone: auth.phone },
      { headers },
    );
  });
}

export async function OPTIONS(request: Request): Promise<Response> {
  const { preflightResponse } = await import("@/lib/http/response");
  return preflightResponse(request) ?? new Response(null, { status: 204 });
}
