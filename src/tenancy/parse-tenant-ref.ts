import { z } from "zod";

import { ValidationError } from "@/lib/errors/api-error";

const tenantRutSchema = z.object({
  "x-tenant-rut": z
    .string()
    .min(1, "X-Tenant-RUT es requerido")
    .regex(/^\d{7,8}-[0-9K]$/i, "X-Tenant-RUT debe tener formato 12345678-9"),
});

export function parseTenantRef(headers: Headers): string {
  const result = tenantRutSchema.safeParse({
    "x-tenant-rut": headers.get("x-tenant-rut"),
  });

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ValidationError(issue?.message ?? "X-Tenant-RUT es requerido");
  }

  return result.data["x-tenant-rut"];
}