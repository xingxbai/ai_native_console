import { z } from "zod";

const repairableInput = z.strictObject({
  orderId: z.number().int().positive().max(999_999),
  view: z.unknown().optional(),
});

export function repairableOrderId(toolName: string, rawInput: string, attempts: number): number | undefined {
  // 只允许修正订单查询的 view；编号本身缺失或无效时不得让模型猜。
  if (toolName !== "getOrderDetail" || attempts >= 1) return undefined;
  try {
    const input = repairableInput.safeParse(JSON.parse(rawInput));
    return input.success ? input.data.orderId : undefined;
  } catch {
    return undefined;
  }
}
