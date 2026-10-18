import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { withUserPostgres } from "@/lib/postgres/with-user-postgres";
import { executeRoute } from "@/lib/http/execute-route";
import { getTenantPrisma } from "@/lib/prisma/clients";
import { parseTenantRef } from "@/tenancy/parse-tenant-ref";
import { ValidationError, TenantNotFoundError, ForbiddenError } from "@/lib/errors/api-error";
import type { AuthContext } from "@/auth/auth-context";
import type { PostgresApi } from "@supabase/server/middleware/postgres";

export type TenantContext = Readonly<{
  tenantId: string;
  clientRut: string;
  schema: string;
  role: string;
}>;

export type PrivateHandlerContext = Readonly<{
  auth: AuthContext;
  tenant: TenantContext;
  postgres: PostgresApi;
  prisma: ReturnType<typeof getTenantPrisma>;
}>;

export type ProtectedHandlerContext = Readonly<{
  auth: AuthContext;
  postgres: PostgresApi;
  tenant?: TenantContext;
  prisma?: ReturnType<typeof getTenantPrisma>;
}>;

type RouteHandler = (request: Request, context: unknown) => Promise<Response>;

function runWithTenant(
  request: Request,
  auth: AuthContext,
  postgres: PostgresApi,
  handler: (context: PrivateHandlerContext) => Promise<Response>
): Promise<Response> {
  return executeRoute(request, async () => {
    const schemaName = parseTenantRef(request.headers);

    const record = await resolveTenantByRut(auth, postgres, schemaName);
    if (!record) {
      throw new TenantNotFoundError();
    }

    const tenant: TenantContext = Object.freeze({
      tenantId: record.id,
      clientRut: record.rut,
      schema: record.schemaName,
      role: record.role,
    });

    const prisma = getTenantPrisma(tenant.schema);

    return handler({
      auth,
      tenant,
      postgres,
      prisma,
    });
  });
}

async function resolveTenantOptional(
  request: Request,
  auth: AuthContext,
  postgres: PostgresApi
): Promise<{ tenant: TenantContext; prisma: ReturnType<typeof getTenantPrisma> } | null> {
  const rutHeader = request.headers.get("x-tenant-rut");
  if (!rutHeader) {
    return null;
  }

  const record = await resolveTenantByRut(auth, postgres, rutHeader);
  if (!record) {
    return null;
  }

  const tenant: TenantContext = Object.freeze({
    tenantId: record.id,
    clientRut: record.rut,
    schema: record.schemaName,
    role: record.role,
  });

  const prisma = getTenantPrisma(tenant.schema);
  return { tenant, prisma };
}

export function withPublic(handler: RouteHandler): (request: Request) => Promise<Response> {
  return (request: Request) => executeRoute(request, () => handler(request, undefined));
}

export function withProtected(
  handler: (request: Request, context: ProtectedHandlerContext) => Promise<Response>,
  options: Readonly<{ withTenant?: boolean }> = {}
): (request: Request) => Promise<Response> {
  return withUserPostgres(async (request, context) => {
    let tenantCtx: ProtectedHandlerContext = {
      auth: context.auth,
      postgres: context.postgres,
    };

    if (options.withTenant) {
      const resolved = await resolveTenantOptional(request, context.auth, context.postgres);
      if (resolved) {
        tenantCtx = {
          ...tenantCtx,
          tenant: resolved.tenant,
          prisma: resolved.prisma,
        };
      }
    }

    return handler(request, tenantCtx);
  });
}

export function withPrivate(
  handler: (request: Request, context: PrivateHandlerContext) => Promise<Response>
): (request: Request) => Promise<Response> {
  return withUserPostgres(async (request, context) => {
    // API Key por cliente (tenant): pendiente de implementar.
    // Cuando se defina, se validara aqui (una key por tenant), no via variable global.

    return runWithTenant(request, context.auth, context.postgres, (innerCtx) =>
      handler(request, innerCtx)
    );
  });
}

async function resolveTenantByRut(
  auth: AuthContext,
  postgres: PostgresApi,
  rut: string
): Promise<{ id: string; rut: string; schemaName: string; role: string } | null> {
  const digits = rut.replace("-", "").replace(/[^0-9]/g, "");
  const schemaName = `client_${digits}`;

  const rows = await postgres.query<{ id: string; rut: string; schema_name: string; role: string }>`
    select
      t.id,
      t.rut,
      t.schema_name,
      tm.role
    from public.tenant_members as tm
    inner join public.tenants as t on t.id = tm.tenant_id
    where t.rut = ${rut}
      and t.schema_name = ${schemaName}
      and tm.user_id = ${auth.userId}::uuid
      and t.activo = true
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    rut: row.rut,
    schemaName: row.schema_name,
    role: row.role,
  });
}
