import { z } from "zod";

import type { PostgresApi } from "@supabase/server/middleware/postgres";

import type { TenantRole, TenantSummary } from "@/tenancy/tenant-context";

const tenantRoleSchema = z.enum(["owner", "admin", "member"]);

type TenantRow = Readonly<{
  id: string;
  rut: string;
  nombre: string;
  slug: string;
  schema_name: string;
  role: string;
}>;

export type TenantRecord = Readonly<{
  id: string;
  rut: string;
  nombre: string;
  slug: string;
  schemaName: string;
  role: TenantRole;
}>;

export interface TenantRepository {
  listAccessibleByUser(userId: string): Promise<ReadonlyArray<TenantRecord>>;
  findAccessibleById(userId: string, tenantId: string): Promise<TenantRecord | null>;
}

function mapRow(row: TenantRow): TenantRecord {
  return Object.freeze({
    id: row.id,
    rut: row.rut,
    nombre: row.nombre,
    slug: row.slug,
    schemaName: row.schema_name,
    role: tenantRoleSchema.parse(row.role),
  });
}

export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly postgres: PostgresApi) {}

  async listAccessibleByUser(userId: string): Promise<ReadonlyArray<TenantRecord>> {
    const rows = await this.postgres.query<TenantRow>`
      select
        t.id,
        t.rut,
        t.nombre,
        t.slug,
        t.schema_name,
        tm.role
      from public.tenant_members as tm
      inner join public.tenants as t on t.id = tm.tenant_id
      where tm.user_id = ${userId}::uuid
        and t.activo = true
      order by t.nombre asc, t.slug asc
    `;

    return rows.map(mapRow).map((record) => Object.freeze(record));
  }

  async findAccessibleById(userId: string, tenantId: string): Promise<TenantRecord | null> {
    const rows = await this.postgres.query<TenantRow>`
      select
        t.id,
        t.rut,
        t.nombre,
        t.slug,
        t.schema_name,
        tm.role
      from public.tenant_members as tm
      inner join public.tenants as t on t.id = tm.tenant_id
      where t.id = ${tenantId}::uuid
        and tm.user_id = ${userId}::uuid
        and t.activo = true
      limit 1
    `;

    const row = rows[0];
    return row ? mapRow(row) : null;
  }
}

export function toTenantSummary(record: TenantRecord): TenantSummary {
  return Object.freeze({
    id: record.id,
    rut: record.rut,
    nombre: record.nombre,
    slug: record.slug,
    role: record.role,
  });
}
