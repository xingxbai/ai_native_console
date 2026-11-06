import { z } from "zod";

const nodeSchema = z.strictObject({
  id: z.string().min(1).max(80),
  type: z.enum(["query", "approval", "end"]),
  label: z.string().trim().min(1).max(80),
  position: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
});
const edgeSchema = z.strictObject({ source: z.string().min(1), target: z.string().min(1) });
export const workflowSchema = z.strictObject({
  version: z.literal(1),
  nodes: z.array(nodeSchema).min(2).max(30),
  edges: z.array(edgeSchema).max(60),
});

export function validateWorkflow(input: unknown): { valid: boolean; issues: string[] } {
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: ["版本、节点或连线格式不合法"] };
  const { nodes, edges } = parsed.data;
  const ids = new Set(nodes.map((node) => node.id));
  const issues: string[] = [];
  if (ids.size !== nodes.length) issues.push("节点 ID 重复");
  if (nodes.filter((node) => node.type === "end").length !== 1) issues.push("必须有且只有一个结束节点");

  // 前端连接限制可以绕过，服务端必须用提交的完整图重新检查。
  const neighbors = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) { issues.push("连线引用不存在的节点"); continue; }
    if (edge.source === edge.target || nodes.find((node) => node.id === edge.source)?.type === "end") issues.push("存在无效连线");
    neighbors.get(edge.source)!.push(edge.target);
  }
  const incoming = new Set(edges.map((edge) => edge.target));
  // 当前课程只允许一个起点，避免执行入口不明确。
  const roots = nodes.filter((node) => !incoming.has(node.id));
  if (roots.length !== 1) issues.push("必须有且只有一个起点");
  const visited = new Set<string>();
  const active = new Set<string>();
  let cycle = false;
  function visit(id: string) {
    if (active.has(id)) { cycle = true; return; }
    if (visited.has(id)) return;
    active.add(id);
    for (const next of neighbors.get(id) ?? []) visit(next);
    active.delete(id);
    visited.add(id);
  }
  for (const node of nodes) visit(node.id);
  if (cycle) issues.push("流程中存在环路");
  if (roots.length === 1) {
    const reachable = new Set<string>();
    function walk(id: string) { if (reachable.has(id)) return; reachable.add(id); for (const next of neighbors.get(id) ?? []) walk(next); }
    walk(roots[0].id);
    if (reachable.size !== nodes.length) issues.push("存在无法从起点到达的节点");
  }
  if (nodes.some((node) => node.type !== "end" && (neighbors.get(node.id)?.length ?? 0) === 0)) issues.push("非结束节点缺少后续连线");
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}
