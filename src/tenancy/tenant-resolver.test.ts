import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TenantNotFoundError } from "@/lib/errors/api-error";
import type { AuthContext } from "@/auth/auth-context";
import { TenantResolver } from "@/tenancy/tenant-resolver";
import type { TenantRecord, TenantRepository } from "@/tenancy/tenant-repository";

const tenantId = "0f3d0b07-5e8f-4d3b-9c2e-2f4b41f70ca1";
const auth: AuthContext = Object.freeze({
  userId: "7ca37751-5877-4c65-9a6a-1552ea622ea3",
  email: "user@example.com",
  phone: null,
});
const record: TenantRecord = Object.freeze({
  id: tenantId,
  rut: "00000000-0",
  nombre: "Tenant de Prueba",
  slug: "tenant-test",
  schemaName: "client_00000000",
  role: "owner",
});

const postgres = Object.freeze({}) as never;

class RepositoryStub implements TenantRepository {
  constructor(private readonly result: TenantRecord | null) {}

  async listAccessibleByUser(): Promise<ReadonlyArray<TenantRecord>> {
    return this.result ? [this.result] : [];
  }

  async findAccessibleById(): Promise<TenantRecord | null> {
    return this.result;
  }
}

describe("TenantResolver", () => {
  it("resolves an active tenant membership into an immutable context", async () => {
    const resolver = new TenantResolver(new RepositoryStub(record));
    const context = await resolver.resolve({
      headers: new Headers({ "X-Tenant-Id": tenantId }),
      auth,
      postgres,
    });

    expect(context).toEqual({
      tenantId,
      clientRut: "00000000-0",
      schema: "client_00000000",
      role: "owner",
    });
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("returns 404 when the tenant is not visible", async () => {
    const resolver = new TenantResolver(new RepositoryStub(null));
    const request = {
      headers: new Headers({ "X-Tenant-Id": tenantId }),
      auth,
      postgres,
    };

    await expect(resolver.resolve(request)).rejects.toBeInstanceOf(TenantNotFoundError);
  });

  it("rejects a schema name as tenant identifier", async () => {
    const resolver = new TenantResolver(new RepositoryStub(record));
    const request = {
      headers: new Headers({ "X-Tenant-Id": "client_00000000" }),
      auth,
      postgres,
    };

    await expect(resolver.resolve(request)).rejects.toThrow();
  });
});
