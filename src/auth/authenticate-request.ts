import "server-only";

import { createContextClient, verifyAuth } from "@supabase/server/core";
import type { AuthError, JWTClaims } from "@supabase/server";

import { getSupabaseEnv } from "@/config/env";
import { InternalServerError, UnauthorizedError } from "@/lib/errors/api-error";
import type { AuthContext } from "@/auth/auth-context";

export type VerifiedAuth = Readonly<{
  claims: JWTClaims;
  auth: AuthContext;
}>;

function mapAuthError(error: AuthError): InternalServerError | UnauthorizedError {
  if (error.status === 401 || error.status === 403) {
    return new UnauthorizedError("The access token is invalid or expired");
  }

  return new InternalServerError();
}

export async function authenticateRequest(request: Request): Promise<AuthContext> {
  return (await verifyRequest(request)).auth;
}

export async function verifyRequest(request: Request): Promise<VerifiedAuth> {
  const env = getSupabaseEnv();
  const supabaseEnv = {
    url: env.url,
    publishableKeys: { default: env.publishableKey },
    secretKeys: {},
  } as const;

  const result = await verifyAuth(request, {
    auth: "user",
    env: supabaseEnv,
  });

  if (result.error || !result.data.token || !result.data.jwtClaims) {
    throw result.error
      ? mapAuthError(result.error)
      : new UnauthorizedError("The access token is invalid or expired");
  }

  const supabase = createContextClient({
    auth: { token: result.data.token },
    env: supabaseEnv,
  });
  const { data, error } = await supabase.auth.getUser();
  const claims = result.data.jwtClaims;

  if (
    error ||
    !data.user ||
    claims.role !== "authenticated" ||
    claims.sub !== data.user.id
  ) {
    throw new UnauthorizedError("The access token is invalid or expired");
  }

  return Object.freeze({
    claims,
    auth: Object.freeze({
      userId: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
    }),
  });
}
