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
import { findDirectTool } from "./direct-tools.js";

const SYSTEM_INSTRUCTIONS = "Answer in the user's language, briefly and directly. Use at most three short paragraphs or bullets. Do not claim access to business data or tools.";
const ANALYSIS_INSTRUCTIONS = "Analyze the user's engineering question in their language. Give a concise summary, one concrete risk, and one actionable next step. Do not claim access to business data or tools.";
const VISUAL_INSTRUCTIONS = "Return one UI data object. Choose kpi for one number, table for comparison, or bar for a numeric comparison. Use short labels and at most eight rows. User-provided numbers are illustrative only; never invent business facts or claim access to live data.";
const TOOL_INSTRUCTIONS = "Answer in the user's language. For questions about the demo task completion statistics, use the getDemoTaskStats tool. Clearly state that these are public sample data, not real business metrics. For unrelated questions, answer directly.使用getDemoUserInfo工具获取当前用户的个人信息。不要编造业务数据或声称访问实时数据。";

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
    const directTool = findDirectTool(input.data.message);
    if (!modelProvider && !directTool) throw new ApiError("MODEL_UNAVAILABLE", 503, "DeepSeek is not configured");

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
      yield frame({ type: "start", requestId, provider: directTool ? "local" : "deepseek", model: directTool?.name ?? provider!.model, format });
      try {
        if (directTool) {
          // 注册表中的工具直接产出文本流，SSE 层只负责转发。
          for await (const text of directTool.stream(controller.signal)) yield frame({ type: "delta", text });
          if (!controller.signal.aborted) yield frame({ type: "done", requestId });
        } else if (format === "tool") {
          for await (const text of provider!.streamToolReply(TOOL_INSTRUCTIONS, message, controller.signal)) {
            yield frame({ type: "delta", text });
          }
          if (!controller.signal.aborted) yield frame({ type: "done", requestId });
        } else if (format === "visual") {
          const value = await provider!.streamVisual(VISUAL_INSTRUCTIONS, message, controller.signal);
          if (!controller.signal.aborted) yield frame({ type: "visual_done", value, requestId });
        } else if (format === "analysis") {
          for await (const event of provider!.streamAnalysis(ANALYSIS_INSTRUCTIONS, message, controller.signal)) {
            if (event.type === "partial") yield frame({ type: "partial", value: event.value });
            else yield frame({ type: "analysis_done", value: event.value, requestId });
          }
        } else {
          for await (const text of provider!.streamReply(SYSTEM_INSTRUCTIONS, message, controller.signal)) {
            yield frame({ type: "delta", text });
          }
          if (!controller.signal.aborted) yield frame({ type: "done", requestId });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = error instanceof ModelTimeoutError ? "MODEL_TIMEOUT"
          : error instanceof ModelOutputLimitError ? "MODEL_INVALID_RESPONSE" : "MODEL_UNAVAILABLE";
        // 开发时保留异常堆栈便于定位；生产日志只记错误类型，避免泄露工具返回的数据。
        request.log.error({ requestId, format, ...(process.env.NODE_ENV === "production"
          ? { errorName: error instanceof Error ? error.name : "UnknownError" }
          : { err: error }) }, "model stream failed");
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
