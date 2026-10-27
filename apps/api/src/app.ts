import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import {
  apiErrorResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  healthQuerySchema,
  healthResponseSchema,
  type ApiErrorCode,
} from "@ai-native-console/contracts";
import { ModelOutputLimitError, ModelTimeoutError, type ModelProvider } from "./model-provider.js";

const SYSTEM_INSTRUCTIONS = "Answer in the user's language, briefly and directly. Use at most three short paragraphs or bullets. Do not claim access to business data or tools.";

class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApp(options: { logger?: boolean; modelProvider?: ModelProvider } = {}) {
  const modelProvider = options.modelProvider;
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

  app.post("/api/v1/chat", async (request) => {
    const input = chatRequestSchema.safeParse(request.body);
    if (!input.success) {
      throw new ApiError("VALIDATION_ERROR", 400, "Invalid chat request");
    }
    if (!modelProvider) {
      throw new ApiError("MODEL_UNAVAILABLE", 503, "DeepSeek is not configured");
    }

    let content: string;
    try {
      content = await modelProvider.generateReply(SYSTEM_INSTRUCTIONS, input.data.message);
    } catch (error) {
      if (error instanceof ModelTimeoutError) {
        throw new ApiError("MODEL_TIMEOUT", 504, "Model request timed out");
      }
      if (error instanceof ModelOutputLimitError) {
        throw new ApiError("MODEL_INVALID_RESPONSE", 502, "Model output was incomplete");
      }
      request.log.warn({ requestId: request.id, errorName: error instanceof Error ? error.name : "UnknownError" }, "model request failed");
      throw new ApiError("MODEL_UNAVAILABLE", 503, "Model is temporarily unavailable");
    }

    if (!content.trim() || content.length > 4_000) {
      throw new ApiError("MODEL_INVALID_RESPONSE", 502, "Model returned invalid text");
    }

    return chatResponseSchema.parse({
      reply: { role: "assistant", content: content.trim() },
      provider: "deepseek",
      model: modelProvider.model,
      requestId: request.id,
    });
  });

  return app;
}
