import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { GET } = await import("@/app/api/protected/me/route");

describe("GET /api/protected/me", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:4200");
  });

  it("returns 401 when no bearer token is provided", async () => {
    const response = await GET(
      new Request("http://localhost/api/protected/me", {
        headers: { Origin: "http://localhost:4200" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "The access token is invalid or expired",
      },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
