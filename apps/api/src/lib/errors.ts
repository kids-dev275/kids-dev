import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiErrorResponse } from "@kids-wear/shared";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND", details?: unknown) {
    super(404, code, message, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST", details?: unknown) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED", details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN", details?: unknown) {
    super(403, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT", details?: unknown) {
    super(409, code, message, details);
  }
}

/**
 * Centralized Fastify error handler ensuring safe, standardized API responses.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Known operational application errors
  if (error instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined && { details: error.details }),
      },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // Rate limit errors
  const fastifyErr = error as FastifyError;
  if (fastifyErr.statusCode === 429) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
      },
    };
    reply.status(429).send(response);
    return;
  }

  // Fastify request validation errors
  if (fastifyErr.validation) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: fastifyErr.message,
      },
    };
    reply.status(400).send(response);
    return;
  }

  // Fastify HTTP errors (e.g., FST_ERR_CTP_INVALID_MEDIA_TYPE)
  if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: fastifyErr.code || "CLIENT_ERROR",
        message: fastifyErr.message,
      },
    };
    reply.status(fastifyErr.statusCode).send(response);
    return;
  }

  // Unexpected / 500 internal errors
  request.log.error(error);

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred",
    },
  };

  reply.status(500).send(response);
}

/**
 * Standardized 404 handler for routes not found.
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${request.method} ${request.url} not found`,
    },
  };
  reply.status(404).send(response);
}
