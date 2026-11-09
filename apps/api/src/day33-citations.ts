import { answerFromKnowledge } from "./knowledge-answer.js";
import { demoKnowledgeActor } from "./knowledge-search.js";

const signal = AbortSignal.timeout(5_000);
for (const query of ["退款 时限", "TIMEOUT 超时", "发票开具", "租户 B 特殊退款政策", "主管 审计 记录"]) {
  console.log(query, JSON.stringify(await answerFromKnowledge(query, demoKnowledgeActor, signal)));
}
