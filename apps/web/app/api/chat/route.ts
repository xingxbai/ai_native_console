import { randomUUID } from "node:crypto";
import {
  apiErrorResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  requestIdSchema,
  type ApiErrorCode,
} from "@ai-native-console/contracts";
import { getApiInternalUrl } from "../../../lib/api-health";

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

  try {
    const response = await fetch(new URL("/api/v1/chat", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const requestId = requestIdSchema.safeParse(response.headers.get("x-request-id"));
    const body: unknown = await response.json();
    if (!requestId.success) {
      return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid response", 502);
    }

    if (response.ok) {
      const reply = chatResponseSchema.safeParse(body);
      if (!reply.success || reply.data.requestId !== requestId.data) {
        return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid response", 502);
      }
      return Response.json(reply.data, { headers: { "x-request-id": requestId.data } });
    }

    const apiError = apiErrorResponseSchema.safeParse(body);
    if (!apiError.success || apiError.data.error.requestId !== requestId.data) {
      return errorResponse("MODEL_INVALID_RESPONSE", "API returned an invalid response", 502);
    }
    return Response.json(apiError.data, {
      status: response.status,
      headers: { "x-request-id": requestId.data },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return timedOut
      ? errorResponse("MODEL_TIMEOUT", "API request timed out", 504)
      : errorResponse("MODEL_UNAVAILABLE", "API is unavailable", 503);
  }
}
