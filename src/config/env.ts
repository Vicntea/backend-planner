import "server-only";

import { z } from "zod";

const optionalUrl = z.string().trim().min(1).optional();

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: optionalUrl,
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

const databaseEnvSchema = z.object({
  SUPABASE_DB_URL: z.string().url(),
});

const supabaseAdminEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type SupabaseEnv = Readonly<{
  url: string;
  publishableKey: string;
  databaseUrl: string | undefined;
  allowedOrigins: ReadonlySet<string>;
}>;

function getAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = supabaseEnvSchema.parse(process.env);

  return Object.freeze({
    url: env.SUPABASE_URL,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    databaseUrl: env.SUPABASE_DB_URL,
    allowedOrigins: getAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
  });
}

export function getRlsDatabaseUrl(): string {
  return databaseEnvSchema.parse(process.env).SUPABASE_DB_URL;
}

export function getSupabaseAdminEnv(): Readonly<{
  url: string;
  secretKey: string;
}> {
  const env = supabaseAdminEnvSchema.parse(process.env);
  return Object.freeze({ url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY });
}
