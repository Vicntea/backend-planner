import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors/api-error";
import { parseTenantId } from "@/tenancy/parse-tenant-id";

const validTenantId = "0f3d0b07-5e8f-4d3b-9c2e-2f4b41f70ca1";

describe("parseTenantId", () => {
  it("accepts a UUID tenant identifier", () => {
    const headers = new Headers({ "X-Tenant-Id": validTenantId });
    expect(parseTenantId(headers)).toBe(validTenantId);
  });

  it("rejects a missing identifier", () => {
    expect(() => parseTenantId(new Headers())).toThrow(ValidationError);
  });

  it("rejects a non-UUID identifier", () => {
    const headers = new Headers({ "X-Tenant-Id": "client_00000000" });
    expect(() => parseTenantId(headers)).toThrow(ValidationError);
  });
});
