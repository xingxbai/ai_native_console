import { demoKnowledgeActor, readKnowledgeSource, searchKnowledge } from "./knowledge-search.js";

const source = await readKnowledgeSource(AbortSignal.timeout(5_000));
for (const [name, query] of [
  ["退款时限", "退款 时限"],
  ["失败排查", "TIMEOUT 超时"],
  ["旧版排除", "7 天 退款"],
  ["无结果", "发票开具"],
  ["跨租户排除", "租户 B 特殊退款政策"],
  ["角色排除", "主管 审计 记录"],
] as const) {
  console.log(name, JSON.stringify(searchKnowledge(source, { query }, demoKnowledgeActor)));
}
console.log("主管可见", JSON.stringify(searchKnowledge(source, { query: "主管 审计 记录" }, { tenantId: "demo-a", role: "manager" })));

// 在内存副本上切换有效版本，验证重建索引后只返回当前版本。
const previous = structuredClone(source);
const refund = previous.documents.find((document) => document.id === "refund-policy")!;
for (const version of refund.versions) version.active = version.version === 1;
console.log("切换有效版本", JSON.stringify(searchKnowledge(previous, { query: "退款 时限" }, demoKnowledgeActor)));
