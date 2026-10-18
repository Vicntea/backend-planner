export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ status: "ok", version: "v2" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}