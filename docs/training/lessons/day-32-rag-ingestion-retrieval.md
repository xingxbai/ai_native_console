# Day 32：RAG 数据摄取与检索基础

日期：2026-11-06。状态：**IN_PROGRESS（关键词检索基线已验；embedding/向量未实现）**。前置：Day 19 数据最小化、Day 31 业务事实口径。只做文档摄取和检索，不让模型根据片段生成答案；引用校验和拒答留 Day 33。

## 1. 真实场景与目标

客服问“签收后多久能申请退款？”这不是订单数据库里的实时状态，而是业务手册里的规则。RAG 的第一步是把手册拆成小片段，带上来源、版本和权限，再按问题找出可见片段。模型以后只能用这些证据回答；**检索命中不等于答案一定正确**。

本课用结构化 JSON 表示手册与章节。一个 `section` 是一个 chunk，避免在学习第一步就引入复杂的 PDF/Markdown 切分器。数据包含退款手册旧版 7 天、新版 14 天，故障排查、主管专用内容和另一租户手册。

## 2. 重点代码与操作

重点按 `readKnowledgeSource` → `searchKnowledge` → API 路由阅读。源码在 `apps/api/src/knowledge-search.ts`，演示文档在 `apps/api/src/data/knowledge-manuals.json`。

```ts
const chunks = source.documents.flatMap((document) =>
  document.tenantId === actor.tenantId && document.roles.includes(actor.role)
    ? document.versions.filter((version) => version.active).flatMap((version) =>
        version.sections.map((section) => ({
          id: `${document.id}:v${version.version}:${section.id}`,
          documentId: document.id, version: version.version, sectionId: section.id,
          title: document.title, heading: section.heading, content: section.content,
        })))
    : []);
```

这一步先按**服务端身份**过滤，再建立 MiniSearch 全文索引；模型或浏览器不能提供 `tenantId` 和 `role` 来扩大范围。`Intl.Segmenter` 把中文切成词，MiniSearch 负责成熟的关键词索引与排名。返回最多三个片段，每个片段保留 `documentId/version/sectionId`。本课尚未生成 embedding，也没有语义向量库；关键词搜“签收多久”是否能召回“退款时限”需要单独评测，不能假装它具有语义理解。

运行：

```bash
pnpm --filter @ai-native-console/api day32:knowledge
```

Fastify 只读入口为 `POST /api/v1/knowledge/search`，请求形如 `{ "query": "退款 时限" }`。当前 API 使用固定演示客服身份，未接真实登录态；页面尚无检索界面。

## 3. 通用五大深水坑

| 深水坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 本课返回完整片段 JSON，不做流式答案或模型生成组件。 |
| 工具参数与自我纠错 | 查询词必须通过长度校验；检索结果不能当成模型指令。 |
| 上下文与 Token | 最多返回三个 chunk，避免把整本手册送入模型。 |
| HITL 与副作用安全 | 只读规则检索；命中主管审批规则不代表已获批准。 |
| 取消、断流与恢复 | 文件读取有取消信号；没有持续运行或重连语义。 |

## 4. 本课专项五大深水坑

| 失效场景 | 本课处理 | 实际验收 |
| --- | --- | --- |
| 旧版本混入答案 | 只索引 `active` 版本 | 当前命中 v2 的 14 天；旧版 7 天不命中。 |
| 跨租户泄露 | 索引前按服务端 tenant 过滤 | 搜其他租户专属规则为空。 |
| 角色越权 | 按服务端 role 过滤 | 客服搜主管审计为空；主管可见。 |
| 无关问题硬凑片段 | 关键词 AND 检索，无命中返回空数组 | “发票开具”为空。 |
| 把关键词检索说成语义向量 | 本课不生成 embedding | 课件与进度明确标注缺口。 |

## 5. 实际测试与验收

实际执行 `day32:knowledge` exit 0：退款时限命中 `refund-policy:v2:deadline`，内容为 14 天；TIMEOUT 命中故障手册；旧版 7 天、发票、其他租户和客服无权看的主管规则均为空；主管身份能看到审计片段。内存副本切换有效版本后命中 `v1` 的 7 天，证明重建索引会使用当前版本。Fastify `app.inject` 验证检索 200、无结果 200 空数组、空查询 400。`pnpm -r typecheck`、`pnpm lint`、`pnpm -r test` 均 exit 0（API 15/15、Web 6/6；现有测试不覆盖新检索）。未新增 `.test.ts`，未启动项目或运行 build。

手动验收：运行课程命令，对照 JSON 中两版规则和权限字段；在已有 API 运行环境向 `/api/v1/knowledge/search` 发送上述 JSON。当前没有浏览器界面、真实认证、embedding、向量检索或模型答案；这些均不能宣称通过。

## 6. 模拟面试

**Q1：RAG 和聊天记忆有什么区别？** 推荐回答：RAG 从外部文档检索当前可访问的证据；聊天记忆保存会话历史或摘要，不能替代最新业务手册。追问：为什么旧版 7 天不能进入答案？当前有效版本是 v2，摄取时要按版本过滤。错误答案：“模型记得规则就不用检索”。

**Q2：chunk 大小为什么影响检索？** 推荐回答：片段过大容易带入无关内容、消耗 Token；过小可能丢上下文。本课用手册章节作为可解释基线，后续要用真实问题评测召回。追问：把所有章节拼成一个 chunk 有什么问题？难以定位来源、权限和具体规则。错误答案：“chunk 越小一定越好”。

**Q3：有检索结果就能回答用户吗？** 推荐回答：不能，还要检查相关性、有效版本、访问权限及答案是否被片段支持。追问：无结果怎么办？不编造政策，说明未找到证据或转人工。错误答案：“向量相似度高就一定是真实规则”。

## 7. 复盘与下一课

1. 普通客服为什么搜不到主管审计规则，过滤发生在索引前还是索引后？
2. `documentId/version/sectionId` 三者分别帮助定位什么？
3. 为什么“退款 时限”命中不等于“签收多久”一定能命中？

Git 建议提交文档数据、检索模块、只读 API、命令、课件和进度。本课仍有 embedding/向量检索缺口；Day 33 才讨论混合检索、重排、引用和拒答。本轮停在 Day 32。
