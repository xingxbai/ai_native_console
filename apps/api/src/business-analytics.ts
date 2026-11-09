import { readFile } from "node:fs/promises";
import { z } from "zod";

const querySchema = z.strictObject({
  from: z.iso.date().describe("统计开始日期，格式 YYYY-MM-DD，包含当天"),
  to: z.iso.date().describe("统计结束日期，格式 YYYY-MM-DD，包含当天"),
  province: z.enum(["广东", "浙江"]).optional().describe("可选省份；不提供时统计全部省份"),
});
const recordSchema = z.strictObject({
  id: z.string(), tenantId: z.string(), date: z.iso.date(),
  province: z.enum(["广东", "浙江"]), operator: z.enum(["移动", "联通", "电信"]),
  status: z.enum(["success", "failed"]), failureCode: z.enum(["TIMEOUT", "REJECTED"]).nullable(),
});
const dataSchema = z.strictObject({ source: z.string(), records: z.array(recordSchema) });
export const analyticsQuerySchema = querySchema;
export type AnalyticsActor = { tenantId: string; allowedProvinces: Array<"广东" | "浙江"> };
export const demoAnalyticsActor: AnalyticsActor = { tenantId: "demo-a", allowedProvinces: ["广东", "浙江"] };

const failureNames = { TIMEOUT: "超时", REJECTED: "上游拒绝" } as const;

async function selectRecords(input: unknown, actor: AnalyticsActor, signal: AbortSignal) {
  const query = querySchema.parse(input);
  if (query.from > query.to) throw new Error("开始日期不能晚于结束日期");
  if (query.province && !actor.allowedProvinces.includes(query.province)) throw new Error("无权查询该省份");
  const raw = await readFile(new URL("./data/analytics-events.json", import.meta.url), { encoding: "utf8", signal });
  const data = dataSchema.parse(JSON.parse(raw));
  // 租户和省份范围由服务端身份决定，不能由模型生成的参数扩大。
  const records = data.records.filter((item) => item.tenantId === actor.tenantId
    && actor.allowedProvinces.includes(item.province)
    && item.date >= query.from && item.date <= query.to
    && (!query.province || item.province === query.province));
  return { query, records, source: data.source };
}

export async function getOrderMetrics(input: unknown, actor: AnalyticsActor, signal: AbortSignal) {
  const { query, records, source } = await selectRecords(input, actor, signal);
  const failed = records.filter((item) => item.status === "failed").length;
  // 一条记录代表一次处理尝试；失败率分母是全部尝试，不能换成订单金额或成功数。
  return { source, metric: "处理尝试失败率", range: query, totalAttempts: records.length,
    failedAttempts: failed, failureRate: records.length ? failed / records.length : null };
}

export async function getOperatorMetrics(input: unknown, actor: AnalyticsActor, signal: AbortSignal) {
  const { query, records, source } = await selectRecords(input, actor, signal);
  const rows = (["移动", "联通", "电信"] as const).map((operator) => {
    const group = records.filter((item) => item.operator === operator);
    const failed = group.filter((item) => item.status === "failed").length;
    return { operator, totalAttempts: group.length, failedAttempts: failed,
      failureRate: group.length ? failed / group.length : null };
  });
  return { source, metric: "按运营商统计处理失败率", range: query, rows };
}

export async function getFailureBreakdown(input: unknown, actor: AnalyticsActor, signal: AbortSignal) {
  const { query, records, source } = await selectRecords(input, actor, signal);
  const failures = records.filter((item) => item.status === "failed");
  const rows = (["TIMEOUT", "REJECTED"] as const).map((code) => ({
    code, label: failureNames[code], count: failures.filter((item) => item.failureCode === code).length,
  }));
  return { source, metric: "失败原因分布", range: query, failedAttempts: failures.length, rows };
}
