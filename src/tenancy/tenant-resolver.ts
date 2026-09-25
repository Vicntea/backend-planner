import "server-only";

import { z } from "zod";
import type { PostgresApi } from "@supabase/server/middleware/postgres";

import type { AuthContext } from "@/auth/auth-context";
import { TenantNotFoundError, ValidationError } from "@/lib/errors/api-error";
import { parseTenantId } from "@/tenancy/parse-tenant-id";
import type { TenantContext } from "@/tenancy/tenant-context";
import {
  PostgresTenantRepository,
  type TenantRepository,
} from "@/tenancy/tenant-repository";

export type TenantResolutionInput = Readonly<{
  headers: Headers;
  auth: AuthContext;
  postgres: PostgresApi;
}>;

export class TenantResolver {
  constructor(private readonly repository: TenantRepository) {}

  async resolve(input: TenantResolutionInput): Promise<TenantContext> {
    return this.resolveById(parseTenantId(input.headers), input);
  }

  async resolveById(tenantId: string, input: TenantResolutionInput): Promise<TenantContext> {
    if (!z.uuid().safeParse(tenantId).success) {
      throw new ValidationError("Tenant id must be a valid UUID");
    }

    const record = await this.repository.findAccessibleById(input.auth.userId, tenantId);

    // RLS intentionally makes unauthorized, inactive, and nonexistent tenants
    // indistinguishable. Do not perform an admin lookup merely to reveal that
    // a tenant exists.
    if (!record) {
      throw new TenantNotFoundError();
    }

    return Object.freeze({
      tenantId: record.id,
      clientRut: record.rut,
      schema: record.schemaName,
      role: record.role,
    });
  }
}

export function createTenantResolver(postgres: PostgresApi): TenantResolver {
  return new TenantResolver(new PostgresTenantRepository(postgres));
}
