import { z } from "zod";

export const requestIdSchema = z.uuid();

export const healthQuerySchema = z.strictObject({});

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INTERNAL_ERROR",
]);

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: requestIdSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
