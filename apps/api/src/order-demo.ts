import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getOrderDetailInputSchema, getOrderDetailOutputSchema, getAttendanceDetailsInputSchema, getAttendanceDetailsOutputSchema } from "@ai-native-console/contracts";

const orderSchema = z.object({
  id: z.number().int(), customer: z.string(), status: z.string(), amount: z.number(),
  refundAmount: z.number(), refundDate: z.string().nullable(), refundReason: z.string().nullable(),
});
const dataSchema = z.object({
  asOfDate: z.string(), currentWeek: z.string(), previousWeek: z.string(),
  currentWeekStart: z.string(), currentWeekEnd: z.string(), previousWeekStart: z.string(), previousWeekEnd: z.string(),
  orders: z.array(orderSchema),
});
const attendanceDataSchema = z.object({
  source: z.string(),
  records: z.array(getAttendanceDetailsOutputSchema),
});

export async function readDemoOrders(signal: AbortSignal) {
  // JSON 文件模拟后端订单接口；运行时校验后才参与查询和统计。
  const raw = await readFile(new URL("./data/demo-orders.json", import.meta.url), { encoding: "utf8", signal });
  return dataSchema.parse(JSON.parse(raw));
}

export async function getOrderDetail(input: z.input<typeof getOrderDetailInputSchema>, signal: AbortSignal) {
  // 即使模型 SDK 已校验参数，执行边界仍独立校验，再读取业务数据。
  const { orderId, view } = getOrderDetailInputSchema.parse(input);
  const { orders } = await readDemoOrders(signal);
  const order = orders.find((item) => item.id === orderId);
  if (!order) return { error: "演示订单不存在" };
  return getOrderDetailOutputSchema.parse(view === "status"
    ? { orderId, status: order.status }
    : { orderId, status: order.status, customer: order.customer, amount: order.amount, refundReason: order.refundReason });
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


export async function readDemoAttendance(signal: AbortSignal) {
  // JSON 文件模拟考勤接口；读取后先校验数据结构。
  const raw = await readFile(new URL("./data/attendance.json", import.meta.url), { encoding: "utf8", signal });
  return attendanceDataSchema.parse(JSON.parse(raw));
}
export async function getAttendanceDetails(input: z.input<typeof getAttendanceDetailsInputSchema>, signal: AbortSignal) {
  console.log("getAttendanceDetails called with input:", input);
  const { employeeId, view, month } = getAttendanceDetailsInputSchema.parse(input);
  const data = await readDemoAttendance(signal);
  const employeeInfo = data.records.find((record) => record.employeeId === employeeId && record.month === month);
  if (!employeeInfo) {
    // 员工存在与指定月份有记录是两个不同的业务事实。
    const employeeExists = data.records.some((record) => record.employeeId === employeeId);
    return employeeExists
      ? { error: `演示员工 ${employeeId} 在 ${month} 没有考勤记录` }
      : { error: `演示员工 ${employeeId} 不存在` };
  }
  return view === "status"
    ? { employeeId, month: employeeInfo.month, lateCount: employeeInfo.lateCount, missingClockCount: employeeInfo.missingClockCount }
    : employeeInfo;
}
