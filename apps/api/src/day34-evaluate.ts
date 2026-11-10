import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getFailureBreakdown, getOperatorMetrics, getOrderMetrics } from "./business-analytics.js";
import { answerFromKnowledge } from "./knowledge-answer.js";

const caseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: z.string(), kind: z.literal("knowledge"), query: z.string(),
    expectedSource: z.string().nullable(), role: z.enum(["support", "manager"]).optional(), tenantId: z.string().optional() }),
  z.strictObject({ id: z.string(), kind: z.literal("analytics"), tool: z.enum(["getOrderMetrics", "getOperatorMetrics", "getFailureBreakdown"]),
    from: z.string(), to: z.string(), province: z.enum(["广东", "浙江"]).optional(),
    allowedProvinces: z.array(z.enum(["广东", "浙江"])).optional(), tenantId: z.string().optional(),
    operator: z.enum(["移动", "联通", "电信"]).optional(), code: z.enum(["TIMEOUT", "REJECTED"]).optional(),
    field: z.string().optional(), expected: z.number().nullable().optional(), expectedError: z.string().optional() }),
]);
const raw = await readFile(new URL("../../../docs/training/evals/day-34-golden.json", import.meta.url), "utf8");
const cases = z.array(caseSchema).min(30).parse(JSON.parse(raw));
const tools = { getOrderMetrics, getOperatorMetrics, getFailureBreakdown };
let passed = 0;
const failures: Array<{ id: string; reason: string }> = [];
const byKind = { knowledge: { total: 0, passed: 0 }, analytics: { total: 0, passed: 0 } };

for (const item of cases) {
  byKind[item.kind].total++;
  try {
    if (item.kind === "knowledge") {
      const result = await answerFromKnowledge(item.query, { tenantId: item.tenantId ?? "demo-a", role: item.role ?? "support" }, AbortSignal.timeout(5_000));
      const actual = result.citations[0]?.sourceId ?? null;
      if (actual !== item.expectedSource) throw new Error(`期待 ${item.expectedSource ?? "无结果"}，实际 ${actual ?? "无结果"}`);
      if (actual && (!result.answer.includes(`[${actual}]`) || !result.answer.includes(result.citations[0].quote))) throw new Error("答案缺少对应引用原文");
      if (!actual && result.citations.length) throw new Error("拒答仍带有引用");
    } else {
      const actor = { tenantId: item.tenantId ?? "demo-a", allowedProvinces: item.allowedProvinces ?? ["广东", "浙江"] };
      const result = await tools[item.tool]({ from: item.from, to: item.to, province: item.province }, actor, AbortSignal.timeout(5_000));
      if (item.expectedError) throw new Error(`期待错误“${item.expectedError}”，实际返回成功`);
      const row = "rows" in result ? result.rows.find((entry) =>
        ("operator" in entry && entry.operator === item.operator) || ("code" in entry && entry.code === item.code)) : result;
      const actual = row && item.field ? (row as Record<string, unknown>)[item.field] : undefined;
      if (actual !== item.expected) throw new Error(`期待 ${item.expected}，实际 ${String(actual)}`);
    }
    passed++;
    byKind[item.kind].passed++;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (item.kind === "analytics" && item.expectedError === reason) { passed++; byKind.analytics.passed++; }
    else failures.push({ id: item.id, reason });
  }
}

console.log(JSON.stringify({ total: cases.length, passed, failed: failures.length, byKind, failures }, null, 2));
// 评测集可包含已知失败；命令本身只有执行异常或数据集无效时才失败。
