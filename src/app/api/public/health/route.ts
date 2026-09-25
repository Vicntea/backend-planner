export const runtime = "nodejs";

type HealthData = Readonly<{
  status: "ok";
}>;

export async function GET(): Promise<Response> {
  const { successResponse } = await import("@/lib/http/response");
  const response = successResponse<HealthData>({ status: "ok" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
