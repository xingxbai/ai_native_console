# Day 33：检索引用与无证据拒答

日期：2026-11-09。状态：**IN_PROGRESS**。前置：Day 32 关键词检索。本课实现可核对的原文引用与拒答；课程标题中的混合检索、重排序尚未实现，也没有调用 DeepSeek 生成手册答案。

## 1. 场景与目标

客服问“退款时限是多少”，系统应给出现行手册原文和来源；问“发票怎么开”而手册没有证据时，应明确说查不到。不能拿旧版、其他租户或无权文档作答。先建立“答案可复核”的基线，再比较更复杂的召回和生成方案。

## 2. 重点代码与操作

阅读顺序：`searchKnowledge`（权限/版本过滤和关键词搜索）→ `answerFromKnowledge`（原文与引用）→ API `/api/v1/knowledge/answer`。核心在 `apps/api/src/knowledge-answer.ts`：

```ts
if (!results.length) return { answer: "未找到当前可访问且有效的手册依据，无法回答。", citations: [] };
const citations = results.map(({ sourceId, documentId, version, sectionId, title, heading, content }) => ({
  sourceId, documentId, version, sectionId, title, heading, quote: content,
}));
return { answer: citations.map((item) => `${item.quote} [${item.sourceId}]`).join("\n"), citations };
```

`sourceId` 来自摄取时生成的 `documentId:version:sectionId`，例如 `refund-policy:v2:deadline`。答案直接使用命中片段原文，因此引用和文本能逐字对照。运行 `pnpm --filter @ai-native-console/api day33:citations`。API 请求为 `POST /api/v1/knowledge/answer`，body `{ "query": "退款 时限" }`。

## 3. 通用五大深水坑

| 坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 本课完整返回 JSON，不把半截内容当证据。 |
| 工具参数与自我纠错 | 查询词先校验；无命中不让模型补造答案。 |
| 上下文与 Token | 最多引用三个 chunk；整本文档不进上下文。 |
| HITL 与副作用安全 | 文档检索只读，不能因规则命中就执行退款。 |
| 取消、断流与恢复 | 文件读取可取消；本课没有断线恢复能力。 |

## 4. 本课专项五大深水坑

| 坑 | 处理/验收 |
| --- | --- |
| 引用 ID 指向旧版本 | 搜索只取 `active`；退款答案引用 v2 的 14 天。 |
| 答案与引文不一致 | 直接拼接命中原文，`quote` 可与源 JSON 逐字核对。 |
| 无证据仍回答 | “发票开具”返回拒答和空引用。 |
| 跨租户/角色泄漏 | 普通客服问租户 B、主管审计均拒答。 |
| 关键词漏召回 | `AND` 搜索不保证语义召回；需要评测后再加混合检索。 |

## 5. 实际测试与验收

`day33:citations` exit 0：退款时限返回 v2 原文和 ID；TIMEOUT 返回故障手册原文；发票、其他租户和主管审计均拒答且引用为空。Fastify `app.inject` 对退款及发票问题均返回 HTTP 200，内容与命令一致。`pnpm -r typecheck`、`pnpm lint`、`pnpm -r test` 和 `git diff --check` 均 exit 0；已有测试 API 15/15、Web 6/6，不覆盖本节新代码。未新增 `.test.ts`、未启动项目、未运行 build。当前 API 使用固定演示客服身份，没有真实登录权限或浏览器界面。

手动验收：运行命令，对照 `knowledge-manuals.json` 中 v2 退款章节的完整句子和 source ID；再查无关问题，确认没有引用。此结果仅证明**有证据时原文回显**，不证明模型能正确综合多个来源。

## 6. 模拟面试

**Q1：为什么有引用 ID 仍可能出现错误答案？** 推荐回答：模型可能引用正确章节，却写出该章节没有支持的结论。本课直接回显原文来避免这类生成偏差；以后自由回答要核对每项主张。追问：只校验 ID 存在够吗？不够，还要查版本、权限与引文内容。错误答案：“有 citation 就一定可信”。

**Q2：没有检索结果时怎么处理？** 推荐回答：明确说明当前可访问有效手册没有依据，不猜政策；可以提示人工核实。追问：搜不到必然不存在吗？不一定，关键词检索可能漏召回。错误答案：“让模型用常识补充”。

**Q3：混合检索和重排序解决什么？** 推荐回答：关键词和语义检索组合可改善不同表达的召回；重排序把候选中最相关的排前面，但两者都不能替代权限和引用校验。追问：本仓库已经验证了向量召回吗？没有。错误答案：“加向量后不需要评测或拒答”。

## 7. 复盘与下一课

1. `sourceId` 的三个部分分别定位什么？
2. 为何“发票开具”拒答仍不能证明手册绝对没有这条规则？
3. 当前原文回答与 DeepSeek 自由总结的取舍是什么？

Git 建议只提交本节引用与 API 及课件。Day 34 才做固定评测集；本轮不开始下一节。
