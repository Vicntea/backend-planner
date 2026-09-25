import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors/api-error";
import { CreateTenantUserService } from "@/tenancy/create-tenant-user.service";
import type { TenantContext } from "@/tenancy/tenant-context";
import type { TenantIdentityAdmin } from "@/tenancy/tenant-identity-admin";

const tenant: TenantContext = Object.freeze({
  tenantId: "0f3d0b07-5e8f-4d3b-9c2e-2f4b41f70ca1",
  clientRut: "00000000-0",
  schema: "client_00000000",
  role: "owner",
});
const input = { email: "new@example.com", password: "correct horse battery", role: "member", emailConfirm: true } as const;

class AdminStub implements TenantIdentityAdmin {
  created = false;
  membership = false;
  deleted = false;

  async createUser() {
    this.created = true;
    return { id: "7ca37751-5877-4c65-9a6a-1552ea622ea3", email: input.email };
  }

  async addMembership() { this.membership = true; }
  async deleteUser() { this.deleted = true; }
}

describe("CreateTenantUserService", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("creates the Auth user and membership for an owner", async () => {
    const admin = new AdminStub();
    const result = await new CreateTenantUserService(admin).execute(tenant, input);

    expect(admin.created).toBe(true);
    expect(admin.membership).toBe(true);
    expect(result).toEqual({ userId: "7ca37751-5877-4c65-9a6a-1552ea622ea3", email: input.email, role: "member" });
  });

  it("rejects callers who are not owners", async () => {
    const service = new CreateTenantUserService(new AdminStub());
    await expect(service.execute({ ...tenant, role: "admin" }, input)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deletes the Auth user when membership creation fails", async () => {
    const admin = new AdminStub();
    vi.spyOn(admin, "addMembership").mockRejectedValue(new Error("membership failed"));
    await expect(new CreateTenantUserService(admin).execute(tenant, input)).rejects.toThrow();
    expect(admin.deleted).toBe(true);
  });
});
