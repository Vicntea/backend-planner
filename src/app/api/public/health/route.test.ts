import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { GET } = await import("@/app/api/public/health/route");

describe("GET /api/public/health", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  it("returns a public success response", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: "ok" },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
