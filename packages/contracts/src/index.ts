import { z } from "zod";

export const requestIdSchema = z.uuid();

export const healthQuerySchema = z.strictObject({});

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export const chatRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(500),
});

export const chatResponseSchema = z.strictObject({
  reply: z.strictObject({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(4_000),
  }),
  provider: z.literal("deepseek"),
  model: z.string().min(1),
  requestId: requestIdSchema,
});

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  "MODEL_TIMEOUT",
  "MODEL_UNAVAILABLE",
  "MODEL_INVALID_RESPONSE",
]);

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: requestIdSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
