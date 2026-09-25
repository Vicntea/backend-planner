export const TENANT_ROLES = ["owner", "admin", "member"] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export type TenantSummary = Readonly<{
  id: string;
  rut: string;
  nombre: string;
  slug: string;
  role: TenantRole;
}>;

export type TenantContext = Readonly<{
  tenantId: string;
  clientRut: string;
  schema: string;
  role: TenantRole;
}>;
