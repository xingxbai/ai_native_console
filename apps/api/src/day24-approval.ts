import { createHash, randomUUID } from "node:crypto";
import { Annotation, END, interrupt, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

const requestSchema = z.strictObject({
  orderId: z.number().int().positive(),
  nextStatus: z.literal("已退款"),
  reason: z.string().trim().min(1).max(100),
});

const State = Annotation.Root({
  request: Annotation<z.infer<typeof requestSchema>>,
  preview: Annotation<{ orderId: number; before: string; after: string; reason: string; version: number }>,
  executed: Annotation<boolean>,
});

// 当前只是教学用只读快照；审批和真实写入留给后续课程。
const order = { id: 124, status: "待退款", version: 3 };
const checkpointer = new MemorySaver();
const graph = new StateGraph(State)
  .addNode("preparePreview", (state) => {
    if (state.request.orderId !== order.id) throw new Error("订单不存在或无权访问");
    return { preview: {
      orderId: order.id, before: order.status, after: state.request.nextStatus,
      reason: state.request.reason, version: order.version,
    } };
  })
  .addNode("approval", (state) => {
    console.log("审批节点：", state.preview);
    interrupt(state.preview);
    // Day 24 不提供 resume；该节点不会执行写操作。
    return {};
  })
  .addEdge(START, "preparePreview")
  .addEdge("preparePreview", "approval")
  .addEdge("approval", END)
  .compile({ checkpointer });

const request = requestSchema.parse({ orderId: 124, nextStatus: "已退款", reason: "商品瑕疵" });
const runId = randomUUID();
const threadId = `demo-order-124:${runId}`;
const config = { configurable: { thread_id: threadId } };
await graph.invoke({ request, executed: false }, config);
const snapshot = await graph.getState(config);
const preview = snapshot.values.preview;
const parameterHash = createHash("sha256").update(JSON.stringify(preview)).digest("hex");

// 这份结构化数据可供页面渲染审批卡片；用户点击批准前必须由服务端鉴权。
const approvalCard = {
  runId, threadId, requester: "demo-agent", requiredApprover: "refund-manager",
  action: "更新订单状态", preview, parameterHash,
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  status: "waiting_approval",
};
console.log(JSON.stringify({ approvalCard, next: snapshot.next, interrupts: snapshot.tasks.flatMap((task) => task.interrupts), executed: snapshot.values.executed, currentOrder: order }, null, 2));

