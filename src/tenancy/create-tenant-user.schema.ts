import { z } from "zod";

import { TENANT_ROLES } from "@/tenancy/tenant-context";

export const createTenantUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(72, "Password must contain at most 72 characters"),
  role: z.enum(TENANT_ROLES).default("member"),
  emailConfirm: z.boolean().default(true),
});

export type CreateTenantUserInput = Readonly<{
  email: string;
  password: string;
  role: (typeof TENANT_ROLES)[number];
  emailConfirm: boolean;
}>;
