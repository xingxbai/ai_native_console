import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import {
  apiErrorResponseSchema,
  healthQuerySchema,
  healthResponseSchema,
  type ApiErrorCode,
} from "@ai-native-console/contracts";

class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const frameworkStatus = typeof error === "object" && error !== null && "statusCode" in error
      ? error.statusCode
      : undefined;
    const statusCode = error instanceof ApiError ? error.statusCode : frameworkStatus === 400 ? 400 : 500;
    const code: ApiErrorCode = error instanceof ApiError
      ? error.code
      : statusCode === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR";
    const message = error instanceof ApiError
      ? error.message
      : statusCode === 400 ? "Invalid request" : "Internal server error";

    if (statusCode === 500) {
      request.log.error({ requestId: request.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "request failed");
    }

    reply.code(statusCode).send(apiErrorResponseSchema.parse({
      error: { code, message, requestId: request.id },
    }));
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(apiErrorResponseSchema.parse({
      error: { code: "NOT_FOUND", message: "Route not found", requestId: request.id },
    }));
  });

  app.get("/health", async (request) => {
    if (!healthQuerySchema.safeParse(request.query).success) {
      throw new ApiError("VALIDATION_ERROR", 400, "Invalid query parameters");
    }
    return healthResponseSchema.parse({ status: "ok" });
  });

  return app;
}
