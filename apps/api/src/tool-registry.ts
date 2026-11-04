import { getAttendanceDetailsInputSchema, getOrderDetailInputSchema } from "@ai-native-console/contracts";
import { getAttendanceDetails, getOrderDetail } from "./order-demo.js";

export type DemoActor = { role: "manager" | "viewer"; orderIds: number[]; employeeIds: number[] };

export class ToolAccessError extends Error {
  constructor(readonly code: "UNKNOWN_TOOL" | "FORBIDDEN") {
    super(code === "UNKNOWN_TOOL" ? "工具未注册" : "无权查询该记录");
    this.name = "ToolAccessError";
  }
}

// 演示身份由 Node 端提供，不能接受模型生成的角色或可访问范围。
export const demoActor: DemoActor = { role: "manager", orderIds: [123, 124, 133], employeeIds: [1024] };

const toolHandlers = {
  getOrderDetail: async (input: unknown, actor: DemoActor, signal: AbortSignal) => {
    const args = getOrderDetailInputSchema.parse(input);
    if (actor.role !== "manager" || !actor.orderIds.includes(args.orderId)) throw new ToolAccessError("FORBIDDEN");
    return getOrderDetail(args, signal);
  },
  getAttendanceDetails: async (input: unknown, actor: DemoActor, signal: AbortSignal) => {
    const args = getAttendanceDetailsInputSchema.parse(input);
    if (actor.role !== "manager" || !actor.employeeIds.includes(args.employeeId)) throw new ToolAccessError("FORBIDDEN");
    return getAttendanceDetails(args, signal);
  },
} as const;

export async function executeRegisteredTool(name: string, input: unknown, actor: DemoActor, signal: AbortSignal) {
  // 工具名先过白名单；参数校验和访问范围检查都在实际执行前完成。
  if (!Object.hasOwn(toolHandlers, name)) throw new ToolAccessError("UNKNOWN_TOOL");
  const handler = toolHandlers[name as keyof typeof toolHandlers];
  return handler(input, actor, signal);
}
