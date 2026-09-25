import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { executeRoute } from "@/lib/http/execute-route";
import { ValidationError } from "@/lib/errors/api-error";
import { corsHeaders, successResponse } from "@/lib/http/response";
import { withUserPostgres } from "@/lib/postgres/with-user-postgres";
import { createTenantUserSchema } from "@/tenancy/create-tenant-user.schema";
import { CreateTenantUserService } from "@/tenancy/create-tenant-user.service";
import { createTenantResolver } from "@/tenancy/tenant-resolver";
import { SupabaseTenantIdentityAdmin } from "@/tenancy/tenant-identity-admin";

export const runtime = "nodejs";

type RouteContext = Readonly<{
  params: Promise<Readonly<{ tenantId: string }>>;
}>;

type CreateUserResponse = Readonly<{
  userId: string;
  email: string | null;
  role: "owner" | "admin" | "member";
}>;

function createHandler(tenantId: string) {
  return withUserPostgres(async (request, context) => {
    const tenant = await createTenantResolver(context.postgres).resolveById(tenantId, {
      headers: request.headers,
      auth: context.auth,
      postgres: context.postgres,
    });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const parsed = createTenantUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError("Invalid tenant user payload", parsed.error.issues);
    }

    const service = new CreateTenantUserService(
      new SupabaseTenantIdentityAdmin(createSupabaseAdminClient()),
    );
    const data = await service.execute(tenant, parsed.data);
    const headers = corsHeaders(request);
    headers.set("Cache-Control", "no-store");

    return successResponse<CreateUserResponse>(data, { status: 201, headers });
  });
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { tenantId } = await context.params;
  const handler = createHandler(tenantId);
  return executeRoute(request, () => handler(request));
}

export function OPTIONS(request: Request): Promise<Response> {
  return executeRoute(request, async () => new Response(null, { status: 204 }));
}
