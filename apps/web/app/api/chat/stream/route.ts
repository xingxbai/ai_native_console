import { randomUUID } from "node:crypto";
import {
  apiErrorResponseSchema,
  chatRequestSchema,
  requestIdSchema,
  type ApiErrorCode,
} from "@ai-native-console/contracts";
import { getApiInternalUrl } from "../../../../lib/api-health";

export async function POST(request: Request) {
  const proxyRequestId = randomUUID();
  const errorResponse = (code: ApiErrorCode, message: string, status: number) => Response.json(
    apiErrorResponseSchema.parse({ error: { code, message, requestId: proxyRequestId } }),
    { status, headers: { "x-request-id": proxyRequestId } },
  );

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("BAD_REQUEST", "Invalid JSON body", 400);
  }
  const parsed = chatRequestSchema.safeParse(input);
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Invalid chat request", 400);

  const baseUrl = getApiInternalUrl();
  if (!baseUrl) return errorResponse("MODEL_UNAVAILABLE", "API is unavailable", 503);

  const controller = new AbortController();
  const timeoutSignal = AbortSignal.timeout(25_000);
  const onAbort = () => controller.abort();
  request.signal.addEventListener("abort", onAbort, { once: true });
  timeoutSignal.addEventListener("abort", onAbort, { once: true });
  if (request.signal.aborted) controller.abort();
  const cleanup = () => {
    request.signal.removeEventListener("abort", onAbort);
    timeoutSignal.removeEventListener("abort", onAbort);
  };
  try {
    const response = await fetch(new URL("/api/v1/chat/stream", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: controller.signal,
    });
    const requestId = requestIdSchema.safeParse(response.headers.get("x-request-id"));
    if (!requestId.success) {
      cleanup();
      return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid response", 502);
    }

    if (!response.ok) {
      const body: unknown = await response.json();
      const apiError = apiErrorResponseSchema.safeParse(body);
      if (!apiError.success || apiError.data.error.requestId !== requestId.data) {
        cleanup();
        return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid response", 502);
      }
      cleanup();
      return Response.json(apiError.data, { status: response.status, headers: { "x-request-id": requestId.data } });
    }

    if (!response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
      cleanup();
      return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid stream", 502);
    }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(stream) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanup();
            stream.close();
          } else {
            stream.enqueue(value);
          }
        } catch (error) {
          cleanup();
          stream.error(error);
        }
      },
      cancel() {
        // 浏览器停止读取响应时，终止到 Fastify 的请求。
        controller.abort();
        cleanup();
        return reader.cancel();
      },
    });
    return new Response(body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
        "x-request-id": requestId.data,
      },
    });
  } catch {
    cleanup();
    const timedOut = timeoutSignal.aborted;
    return timedOut
      ? errorResponse("MODEL_TIMEOUT", "API request timed out", 504)
      : errorResponse("MODEL_UNAVAILABLE", "API is unavailable", 503);
  }
}
