import { ZodError } from "zod";

import { ApiError, InternalServerError } from "@/lib/errors/api-error";
import { errorResponse, preflightResponse } from "@/lib/http/response";

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ApiError(400, "VALIDATION_ERROR", "Request validation failed", error.issues);
  }

  return new InternalServerError();
}

export async function executeRoute(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return preflightResponse(request) ?? new Response(null, { status: 204 });
  }

  try {
    return await handler();
  } catch (error) {
    const normalized = normalizeError(error);

    if (normalized.status >= 500) {
      console.error("Unhandled API error", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }

    return errorResponse(normalized, request);
  }
}
