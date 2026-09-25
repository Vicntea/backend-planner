export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "TENANT_NOT_FOUND"
  | "TENANT_RESOLUTION_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Request validation failed", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication is required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Access is forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "The request conflicts with existing data") {
    super(409, "CONFLICT", message);
  }
}

export class TenantNotFoundError extends ApiError {
  constructor(message = "Tenant not found") {
    super(404, "TENANT_NOT_FOUND", message);
  }
}

export class TenantResolutionError extends ApiError {
  constructor(message = "The requested tenant could not be resolved") {
    super(422, "TENANT_RESOLUTION_ERROR", message);
  }
}

export class InternalServerError extends ApiError {
  constructor() {
    super(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
