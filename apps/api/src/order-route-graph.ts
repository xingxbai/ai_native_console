import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

const inputSchema = z.strictObject({
  orderId: z.number().int().positive(),
  intent: z.enum(["status", "detail"]),
});

const GraphState = Annotation.Root({
  orderId: Annotation<number>,
  intent: Annotation<"status" | "detail">,
  route: Annotation<"status" | "detail">,
  result: Annotation<string>,
  trace: Annotation<string[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),
});

// 本课只决定查询路径，不执行工具或调用模型；真实查询留给 Day 22。
export const orderRouteGraph = new StateGraph(GraphState)
  .addNode("selectRoute", (state) => ({ route: state.intent, trace: ["selectRoute"] }))
  .addNode("status", (state) => ({ result: `准备查询订单 ${state.orderId} 的状态`, trace: ["status"] }))
  .addNode("detail", (state) => ({ result: `准备查询订单 ${state.orderId} 的详情`, trace: ["detail"] }))
  .addEdge(START, "selectRoute")
  .addConditionalEdges("selectRoute", (state) => state.route, { status: "status", detail: "detail" })
  .addEdge("status", END)
  .addEdge("detail", END)
  .compile();

export async function runOrderRoute(input: unknown, recursionLimit = 8) {
  const parsed = inputSchema.parse(input);
  const state = await orderRouteGraph.invoke({ ...parsed, trace: [] }, { recursionLimit });
  return { orderId: state.orderId, route: state.route, result: state.result, trace: state.trace };
}
