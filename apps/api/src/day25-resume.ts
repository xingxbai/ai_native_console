import { createHash, randomUUID } from "node:crypto";
import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph } from "@langchain/langgraph";

type Decision = "approve" | "reject";
type Preview = { orderId: number; before: string; after: string; version: number };
type Approval = { owner: string; approver: string; previewHash: string; expiresAt: number; status: "waiting" | "approved" | "rejected" };

const State = Annotation.Root({
  preview: Annotation<Preview>,
  decision: Annotation<Decision>,
  outcome: Annotation<string>,
});
// 演示数据仅存在于当前 Node 进程：订单和审批记录重启后都会丢失。
const orders = new Map([[124, { status: "待退款", version: 3 }]]);
const approvals = new Map<string, Approval>();
// 哈希把审批决定绑定到申请时展示的订单、前后状态和版本。
const hash = (preview: Preview) => createHash("sha256").update(JSON.stringify(preview)).digest("hex");

const graph = new StateGraph(State)
  .addNode("approval", (state) => {
    // 恢复时此节点重新运行；resume 值成为 interrupt 的返回值。
    const decision = interrupt<Preview, Decision>(state.preview);
    return { decision };
  })
  .addNode("apply", (state) => {
    // 审批期间订单可能被其他流程修改，所以执行前再核对当前状态和版本。
    const order = orders.get(state.preview.orderId);
    if (!order || order.version !== state.preview.version || order.status !== state.preview.before) {
      throw new Error("订单状态已变化");
    }
    order.status = state.preview.after;
    order.version += 1;
    return { outcome: "已执行" };
  })
  .addNode("reject", () => ({ outcome: "已拒绝，订单未修改" }))
  .addEdge(START, "approval")
  // interrupt 返回的决定决定下一站：批准才进入修改节点，拒绝直接结束。
  .addConditionalEdges("approval", (state) => state.decision, { approve: "apply", reject: "reject" })
  .addEdge("apply", END)
  .addEdge("reject", END)
  .compile({ checkpointer: new MemorySaver() });

async function submit(owner: string, approver: string, expiresAt = Date.now() + 60_000) {
  // 每份申请使用独立线程；thread_id 用来找 checkpoint，本身不授予审批权限。
  const threadId = randomUUID();
  const order = orders.get(124)!;
  const preview = { orderId: 124, before: order.status, after: "已退款", version: order.version };
  approvals.set(threadId, { owner, approver, previewHash: hash(preview), expiresAt, status: "waiting" });
  // 首次运行停在 interrupt，订单不会在这里发生修改。
  await graph.invoke({ preview }, { configurable: { thread_id: threadId } });
  return threadId;
}

async function decide(threadId: string, actor: string, decision: Decision, presentedHash?: string) {
  // 先校验审批记录、操作者和有效期；不合格时不恢复图。
  const approval = approvals.get(threadId);
  if (!approval || approval.status !== "waiting") throw new Error("审批不存在或已处理");
  if (actor !== approval.approver || actor === approval.owner) throw new Error("无审批权限");
  if (Date.now() >= approval.expiresAt) throw new Error("审批已过期");
  const config = { configurable: { thread_id: threadId } };
  const snapshot = await graph.getState(config);
  // 同时核对图确实在等审批，以及提交的卡片与 checkpoint 中的预览一致。
  if (!snapshot.next.includes("approval")) throw new Error("图没有等待审批");
  if (hash(snapshot.values.preview) !== approval.previewHash || presentedHash !== approval.previewHash) throw new Error("审批参数已变化");

  // 用同一 thread_id 恢复：approval 节点重跑，interrupt 返回 decision。
  // 本命令串行执行；生产环境还需要持久审批记录和原子状态更新。
  const result = await graph.invoke(new Command({ resume: decision }), config);
  approval.status = decision === "approve" ? "approved" : "rejected";
  return { outcome: result.outcome, order: orders.get(124) };
}

async function scenario(name: string, run: () => Promise<unknown>) {
  try { console.log(name, JSON.stringify(await run())); }
  catch (error) { console.log(name, error instanceof Error ? error.message : String(error)); }
}

const rejected = await submit("alice", "manager");
console.log("暂停快照", (await graph.getState({ configurable: { thread_id: rejected } })).next);
await scenario("拒绝", () => decide(rejected, "manager", "reject", approvals.get(rejected)!.previewHash));
// 先创建两份基于版本 3 的申请；批准其中一份后，另一份就会过时。
const pending = await submit("alice", "manager");
const stale = await submit("alice", "manager");
await scenario("非审批人", () => decide(pending, "bob", "approve", approvals.get(pending)!.previewHash));
await scenario("参数篡改", () => decide(pending, "manager", "approve", "wrong-hash"));
await scenario("批准", () => decide(pending, "manager", "approve", approvals.get(pending)!.previewHash));
await scenario("重复批准", () => decide(pending, "manager", "approve", approvals.get(pending)!.previewHash));
await scenario("订单版本变化", () => decide(stale, "manager", "approve", approvals.get(stale)!.previewHash));
const expired = await submit("alice", "manager", Date.now() - 1);
await scenario("过期", () => decide(expired, "manager", "approve", approvals.get(expired)!.previewHash));
console.log("最终订单", orders.get(124));
