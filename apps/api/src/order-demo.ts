import { readFile } from "node:fs/promises";
import { z } from "zod";

const orderSchema = z.object({
  id: z.number().int(), customer: z.string(), status: z.string(), amount: z.number(),
  refundAmount: z.number(), refundDate: z.string().nullable(), refundReason: z.string().nullable(),
});
const dataSchema = z.object({
  asOfDate: z.string(), currentWeek: z.string(), previousWeek: z.string(),
  currentWeekStart: z.string(), currentWeekEnd: z.string(), previousWeekStart: z.string(), previousWeekEnd: z.string(),
  orders: z.array(orderSchema),
});

export async function readDemoOrders(signal: AbortSignal) {
  // JSON 文件模拟后端订单接口；运行时校验后才参与查询和统计。
  const raw = await readFile(new URL("./data/demo-orders.json", import.meta.url), { encoding: "utf8", signal });
  return dataSchema.parse(JSON.parse(raw));
}

export async function refundComparison(signal: AbortSignal) {
  const data = await readDemoOrders(signal);
  const refunded = data.orders.filter((order) => order.status === "已退款");
  const current = refunded.filter((order) => order.refundDate && order.refundDate >= data.currentWeekStart && order.refundDate <= data.currentWeekEnd);
  const previous = refunded.filter((order) => order.refundDate && order.refundDate >= data.previousWeekStart && order.refundDate <= data.previousWeekEnd);
  const reasons = Object.entries(current.reduce<Record<string, number>>((counts, order) => {
    const reason = order.refundReason ?? "未填写";
    counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {}));
  return { asOfDate: data.asOfDate, currentWeek: data.currentWeek, previousWeek: data.previousWeek,
    currentCount: current.length, previousCount: previous.length, currentReasons: reasons };
}
