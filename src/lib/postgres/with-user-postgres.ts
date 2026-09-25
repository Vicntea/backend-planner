import "server-only";

import { seedContext, type BaseContext } from "@supabase/middleware";
import type { PostgresApi, RequestClaims } from "@supabase/server/middleware/postgres";
import { withPostgresClient } from "@supabase/server/middleware/postgres";

import type { AuthContext } from "@/auth/auth-context";
import { verifyRequest } from "@/auth/authenticate-request";
import { getRlsDatabaseUrl } from "@/config/env";

export type UserDatabaseContext = Readonly<{
  auth: AuthContext;
  postgres: PostgresApi;
}>;

type UserDatabaseHandler = (
  request: Request,
  context: UserDatabaseContext,
) => Promise<Response>;

type RlsUpstreamContext = BaseContext &
  Readonly<{
    auth: AuthContext;
    jwtClaims: RequestClaims;
  }>;

export function withUserPostgres(handler: UserDatabaseHandler): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const verified = await verifyRequest(request);

    // Resolve configuration at request time so building/importing a route does
    // not require database credentials.
    const databaseHandler = withPostgresClient({
      connectionString: getRlsDatabaseUrl(),
    })(async (request, middlewareContext) => {
      // Entry's structural handler type exposes BaseContext as object. The public
      // middleware retains these upstream keys at runtime, so narrow once here.
      const context = middlewareContext as RlsUpstreamContext & { postgres: PostgresApi };

      return handler(
        request,
        Object.freeze({ auth: context.auth, postgres: context.postgres }),
      );
    });

    const upstream: RlsUpstreamContext = {
      ...seedContext(),
      auth: verified.auth,
      jwtClaims: verified.claims,
    };

    return databaseHandler(request, upstream);
  };
}
