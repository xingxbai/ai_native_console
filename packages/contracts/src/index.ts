import { z } from "zod";

export const requestIdSchema = z.uuid();

export const healthQuerySchema = z.strictObject({});

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export const chatRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(500),
  format: z.enum(["text", "analysis"]).optional(),
});

export const analysisSchema = z.strictObject({
  summary: z.string().trim().min(1).max(500),
  risk: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(500),
});

export const partialAnalysisSchema = analysisSchema.partial();

export const streamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("start"),
    requestId: requestIdSchema,
    provider: z.literal("deepseek"),
    model: z.string().min(1),
    format: z.enum(["text", "analysis"]),
  }),
  z.strictObject({ type: z.literal("delta"), text: z.string().min(1) }),
  z.strictObject({ type: z.literal("partial"), value: partialAnalysisSchema }),
  z.strictObject({ type: z.literal("done"), requestId: requestIdSchema }),
  z.strictObject({ type: z.literal("analysis_done"), value: analysisSchema, requestId: requestIdSchema }),
  z.strictObject({
    type: z.literal("error"),
    code: z.enum(["MODEL_TIMEOUT", "MODEL_UNAVAILABLE", "MODEL_INVALID_RESPONSE"]),
    message: z.string(),
    requestId: requestIdSchema,
  }),
]);

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
export type Analysis = z.infer<typeof analysisSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
