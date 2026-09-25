import { NextResponse } from "next/server";

import { getSupabaseEnv } from "@/config/env";
import { ApiError } from "@/lib/errors/api-error";

export type ApiMeta = Readonly<Record<string, unknown>>;

type SuccessBody<T> = Readonly<{
  success: true;
  data: T;
  meta?: ApiMeta;
}>;

type ErrorBody = Readonly<{
  success: false;
  error: Readonly<{
    code: string;
    message: string;
    details?: unknown;
  }>;
}>;

export function successResponse<T>(
  data: T,
  options: Readonly<{ status?: number; meta?: ApiMeta; headers?: HeadersInit }> = {},
): NextResponse<SuccessBody<T>> {
  return NextResponse.json(
    { success: true, data, ...(options.meta ? { meta: options.meta } : {}) },
    { status: options.status ?? 200, headers: options.headers },
  );
}

export function errorResponse(error: ApiError, request: Request): NextResponse<ErrorBody> {
  const headers = corsHeaders(request);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.status < 500 && error.details !== undefined
          ? { details: error.details }
          : {}),
      },
    },
    { status: error.status, headers },
  );
}

function allowedOriginsForResponse(): ReadonlySet<string> {
  try {
    return getSupabaseEnv().allowedOrigins;
  } catch {
    return new Set<string>();
  }
}

export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  const allowed = allowedOriginsForResponse();

  if (origin && allowed.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Headers", "authorization, content-type, x-tenant-id");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Max-Age", "600");
  }

  return headers;
}

export function preflightResponse(request: Request): NextResponse<null> | null {
  const headers = corsHeaders(request);
  if (!request.headers.get("origin") || !headers.has("Access-Control-Allow-Origin")) {
    return null;
  }

  headers.set("Content-Length", "0");
  return new NextResponse(null, { status: 204, headers });
}
