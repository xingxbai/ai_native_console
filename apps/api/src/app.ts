import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  apiErrorResponseSchema,
  chatRequestSchema,
  healthQuerySchema,
  healthResponseSchema,
  streamEventSchema,
  type ApiErrorCode,
  type StreamEvent,
} from "@ai-native-console/contracts";
import { ModelOutputLimitError, ModelTimeoutError, type ModelProvider } from "./model-provider.js";

const SYSTEM_INSTRUCTIONS = "Answer in the user's language, briefly and directly. Use at most three short paragraphs or bullets. Do not claim access to business data or tools.";
const ANALYSIS_INSTRUCTIONS = "Analyze the user's engineering question in their language. Give a concise summary, one concrete risk, and one actionable next step. Do not claim access to business data or tools.";
const VISUAL_INSTRUCTIONS = "Return one UI data object. Choose kpi for one number, table for comparison, or bar for a numeric comparison. Use short labels and at most eight rows. User-provided numbers are illustrative only; never invent business facts or claim access to live data.";

class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, readonly statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function sseFrame(id: string, event: StreamEvent): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(streamEventSchema.parse(event))}\n\n`;
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

  app.post("/api/v1/chat/stream", async (request, reply) => {
    const input = chatRequestSchema.safeParse(request.body);
    if (!input.success) throw new ApiError("VALIDATION_ERROR", 400, "Invalid chat request");
    if (!modelProvider) throw new ApiError("MODEL_UNAVAILABLE", 503, "DeepSeek is not configured");

    const requestId = request.id;
    const message = input.data.message;
    const format = input.data.format ?? "text";
    const provider = modelProvider;
    const controller = new AbortController();
    const onClose = () => {
      // 正常完成也会触发 close；只有响应提前断开才取消模型。
      if (!reply.raw.writableFinished) controller.abort();
    };
    reply.raw.once("close", onClose);
    // 流开始后不能再改 HTTP 状态，模型失败通过终止 error 事件通知页面。
    async function* events() {
      let sequence = 0;
      const frame = (event: StreamEvent) => sseFrame(`${requestId}:${++sequence}`, event);
      yield ": connected\n\n";
      yield frame({ type: "start", requestId, provider: "deepseek", model: provider.model, format });
      try {
        if (format === "visual") {
          const value = await provider.streamVisual(VISUAL_INSTRUCTIONS, message, controller.signal);
          if (!controller.signal.aborted) yield frame({ type: "visual_done", value, requestId });
        } else if (format === "analysis") {
          for await (const event of provider.streamAnalysis(ANALYSIS_INSTRUCTIONS, message, controller.signal)) {
            if (event.type === "partial") yield frame({ type: "partial", value: event.value });
            else yield frame({ type: "analysis_done", value: event.value, requestId });
          }
        } else {
          for await (const text of provider.streamReply(SYSTEM_INSTRUCTIONS, message, controller.signal)) {
            yield frame({ type: "delta", text });
          }
          if (!controller.signal.aborted) yield frame({ type: "done", requestId });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = error instanceof ModelTimeoutError ? "MODEL_TIMEOUT"
          : error instanceof ModelOutputLimitError ? "MODEL_INVALID_RESPONSE" : "MODEL_UNAVAILABLE";
        request.log.warn({ requestId, errorName: error instanceof Error ? error.name : "UnknownError" }, "model stream failed");
        yield frame({ type: "error", code, message: "Model stream failed", requestId });
      }
    }

    reply.headers({
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    });
    const stream = Readable.from(events());
    stream.once("close", () => reply.raw.off("close", onClose));
    return reply.send(stream);
  });

  return app;
}
