import { randomUUID } from "node:crypto";
import { workflowSchema, validateWorkflow } from "./workflow-validation.js";
import type { z } from "zod";

export type RunStatus = "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
export type RunEvent = { runId: string; sequence: number; status: RunStatus; nodeId?: string; message: string };

const transitions: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled"], running: ["waiting_approval", "succeeded", "failed", "cancelled"],
  waiting_approval: ["running", "cancelled"], succeeded: [], failed: [], cancelled: [],
};

export function nextStatus(current: RunStatus, next: RunStatus) {
  if (!transitions[current].includes(next)) throw new Error(`非法状态迁移: ${current} -> ${next}`);
  return next;
}

export async function* runWorkflow(input: unknown, signal?: AbortSignal): AsyncGenerator<RunEvent> {
  const checked = validateWorkflow(input);
  if (!checked.valid) throw new Error(checked.issues.join("；"));
  const { nodes, edges } = workflowSchema.parse(input);
  const byId = new Map<string, z.infer<typeof workflowSchema>["nodes"][number]>(nodes.map((node) => [node.id, node]));
  const incoming = new Set(edges.map((edge) => edge.target));
  let nodeId: string | undefined = nodes.find((node) => !incoming.has(node.id))!.id;
  const runId = randomUUID();
  let sequence = 0;
  let status: RunStatus = "queued";
  const event = (message: string, id?: string): RunEvent => ({ runId, sequence: ++sequence, status, nodeId: id, message });

  yield event("已排队");
  status = nextStatus(status, "running");
  yield event("开始运行");
  while (nodeId) {
    if (signal?.aborted) { status = nextStatus(status, "cancelled"); yield event("已取消"); return; }
    const node: z.infer<typeof workflowSchema>["nodes"][number] = byId.get(nodeId)!;
    // 本课仅观察节点推进；查询节点不调用模型，审批节点也不执行写操作。
    yield event(`进入${node.label}`, node.id);
    if (node.type === "approval") {
      status = nextStatus(status, "waiting_approval");
      yield event("等待人工审批", node.id);
      return;
    }
    if (node.type === "end") {
      status = nextStatus(status, "succeeded");
      yield event("运行完成", node.id);
      return;
    }
    nodeId = edges.find((edge) => edge.source === node.id)?.target;
  }
  status = nextStatus(status, "failed");
  yield event("流程未到达结束节点");
}

export function sseRunFrame(event: RunEvent) {
  return `id: ${event.runId}:${event.sequence}\nevent: run\ndata: ${JSON.stringify(event)}\n\n`;
}
