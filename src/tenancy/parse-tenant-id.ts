import { z } from "zod";

import { ValidationError } from "@/lib/errors/api-error";

const tenantSelectionSchema = z.object({
  "x-tenant-id": z.string().uuid(),
});

export function parseTenantId(headers: Headers): string {
  const result = tenantSelectionSchema.safeParse({
    "x-tenant-id": headers.get("x-tenant-id"),
  });

  if (!result.success) {
    throw new ValidationError("X-Tenant-Id must contain a valid tenant UUID");
  }

  return result.data["x-tenant-id"];
}
