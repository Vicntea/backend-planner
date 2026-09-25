import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { POST } = await import("@/app/api/protected/tenants/[tenantId]/users/route");

describe("POST /api/protected/tenants/[tenantId]/users", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  it("returns 401 without an access token", async () => {
    const response = await POST(
      new Request("http://localhost/api/protected/tenants/0f3d0b07-5e8f-4d3b-9c2e-2f4b41f70ca1/users", { method: "POST" }),
      { params: Promise.resolve({ tenantId: "0f3d0b07-5e8f-4d3b-9c2e-2f4b41f70ca1" }) },
    );

    expect(response.status).toBe(401);
  });
});
