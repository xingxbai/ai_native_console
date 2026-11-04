import { z } from "zod";

export const requestIdSchema = z.uuid();

export const healthQuerySchema = z.strictObject({});

export const healthResponseSchema = z.strictObject({
  status: z.literal("ok"),
});

export const chatRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(500),
  format: z.enum(["text", "analysis", "visual", "tool"]).optional(),
});

// 工具参数只表达查询意图；是否有权查询该订单须由服务端另行判断。
export const getOrderDetailInputSchema = z.strictObject({
  orderId: z.number().int().positive().max(999_999).describe("要查询的演示订单编号，例如 123"),
  view: z.enum(["status", "detail"]).optional().describe("只问状态时选 status；需要订单详情时选 detail，省略时返回详情"),
});



export const getOrderDetailOutputSchema = z.strictObject({
  orderId: z.number().int().positive(),
  status: z.string(),
  customer: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  refundReason: z.string().nullable().optional(),
});

// 工具参数，Deepseek会输出这个结构
export const getAttendanceDetailsInputSchema = z.strictObject({
  employeeId: z.number().int().positive().max(999_999).describe("要查询的员工编号，例如 123"),
  view: z.enum(["status", "detail"]).optional().describe("只问状态时选 status；需要详情时选 detail，省略时返回详情"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
});

export const getAttendanceDetailsOutputSchema = z.strictObject({
  employeeId: z.number().int().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/).describe("查询的月份，格式为 YYYY-MM，例如 2026-11"),
  lateCount: z.number().int().nonnegative().describe("该员工在该月的迟到次数"),
  missingClockCount: z.number().int().nonnegative().describe("该员工在该月的缺卡次数"),
});
export const analysisSchema = z.strictObject({
  summary: z.string().trim().min(1).max(500),
  risk: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(500),
});

export const partialAnalysisSchema = analysisSchema.partial();

export const visualSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("kpi"), title: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(80), value: z.number().finite() }),
  z.strictObject({ type: z.literal("table"), title: z.string().trim().min(1).max(80), rows: z.array(z.strictObject({ label: z.string().trim().min(1).max(80), value: z.number().finite() })).min(1).max(8) }),
  z.strictObject({ type: z.literal("bar"), title: z.string().trim().min(1).max(80), rows: z.array(z.strictObject({ label: z.string().trim().min(1).max(80), value: z.number().finite() })).min(1).max(8) }),
]);

export const streamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("start"),
    requestId: requestIdSchema,
    provider: z.enum(["deepseek", "local"]),
    model: z.string().min(1),
    display: z.enum(["json", "markdown"]).optional(),
    format: z.enum(["text", "analysis", "visual", "tool"]),
  }),
  z.strictObject({ type: z.literal("delta"), text: z.string().min(1) }),
  z.strictObject({ type: z.literal("partial"), value: partialAnalysisSchema }),
  z.strictObject({ type: z.literal("done"), requestId: requestIdSchema }),
  z.strictObject({ type: z.literal("analysis_done"), value: analysisSchema, requestId: requestIdSchema }),
  z.strictObject({ type: z.literal("visual_done"), value: visualSchema, requestId: requestIdSchema }),
  z.strictObject({
    type: z.literal("error"),
    code: z.enum(["MODEL_TIMEOUT", "MODEL_UNAVAILABLE", "MODEL_INVALID_RESPONSE", "TOOL_TIMEOUT", "TOOL_UNAVAILABLE"]),
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
  "TOOL_TIMEOUT",
  "TOOL_UNAVAILABLE",
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
export type Visual = z.infer<typeof visualSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
