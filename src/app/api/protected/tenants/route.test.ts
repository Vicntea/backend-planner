import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { GET } = await import("@/app/api/protected/tenants/route");

describe("GET /api/protected/tenants", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:4200");
  });

  it("returns 401 before database access when no token is provided", async () => {
    const response = await GET(new Request("http://localhost/api/protected/tenants"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });
});
