import { executeRoute } from "@/lib/http/execute-route";
import { corsHeaders, successResponse } from "@/lib/http/response";
import { withUserPostgres } from "@/lib/postgres/with-user-postgres";
import {
  PostgresTenantRepository,
  toTenantSummary,
} from "@/tenancy/tenant-repository";
import type { TenantSummary } from "@/tenancy/tenant-context";

export const runtime = "nodejs";

const listTenants = withUserPostgres(async (request, context) => {
  const repository = new PostgresTenantRepository(context.postgres);
  const records = await repository.listAccessibleByUser(context.auth.userId);
  const tenants: TenantSummary[] = records.map(toTenantSummary);
  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");

  return successResponse(tenants, { headers });
});

export function GET(request: Request): Promise<Response> {
  return executeRoute(request, () => listTenants(request));
}

export function OPTIONS(request: Request): Promise<Response> {
  return executeRoute(request, async () => new Response(null, { status: 204 }));
}
