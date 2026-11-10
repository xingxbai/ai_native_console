# Day 34：Golden Dataset 与回归评测

日期：2026-11-09。状态：**IN_PROGRESS**。前置：Day 31 统计工具、Day 32–33 检索与引用。本课只评测这些确定性链路，尚未评测 DeepSeek 的工具选择和最终回答。

## 1. 场景、目标与流程

手册改版或统计口径修改后，需要知道旧问题是否退化。把固定问题和预期写入 `docs/training/evals/day-34-golden.json`，用 `apps/api/src/day34-evaluate.ts` 调用现有业务函数，对比结果并报告失败。先保留基线，再改进检索并复跑同一批样本。

## 2. 重点代码与操作

阅读顺序：Golden JSON → `day34-evaluate.ts` → `answerFromKnowledge` / `business-analytics.ts`。关键逻辑：

```ts
const cases = z.array(caseSchema).min(30).parse(JSON.parse(raw));
for (const item of cases) {
  if (item.kind === "knowledge") {
    const result = await answerFromKnowledge(item.query, { tenantId: item.tenantId ?? "demo-a", role: item.role ?? "support" }, AbortSignal.timeout(5_000));
    const actual = result.citations[0]?.sourceId ?? null;
    if (actual !== item.expectedSource) throw new Error(`期待 ${item.expectedSource}，实际 ${actual}`);
  }
}
```

实际代码还检查答案中的引用 ID 和原文、统计字段和预期错误。运行 `pnpm --filter @ai-native-console/api day34:evaluate`。34 条中知识问答 18 条、统计 16 条，覆盖权限、旧版本、拒答、数字口径、空分母和错误参数。

## 3. 通用五大深水坑

| 坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 只评最终对象，不把中间片段当答案。 |
| 工具参数与自我纠错 | 输入固定；尚未评估模型产参或纠错。 |
| 上下文与 Token | 按片段引用；未测模型 Token。 |
| HITL 与副作用安全 | 样本只读，不触发订单修改。 |
| 取消、断流与恢复 | 每项有超时信号，不代表 SSE 恢复已测。 |

## 4. 本课专项五大深水坑

| 坑 | 处理/验收 |
| --- | --- |
| 样本全是同词问法 | K11 用“签收后多久可以退货”测改写，真实漏召回。 |
| 为全绿改预期 | K11 预期保留为 `refund-policy:v2:deadline`。 |
| 把工具准确率当 Agent 准确率 | 明确本课没有调用 DeepSeek。 |
| 总分掩盖失败类型 | 同时报告知识 17/18、统计 16/16、失败 ID。 |
| 小样本推断生产质量 | 34 条只是起步集，后续需真实脱敏问题和人工标注。 |

## 5. 实际测试与验收

2026-11-09 实际执行 `pnpm --filter @ai-native-console/api day34:evaluate`：exit 0，**33/34**；知识 17/18、统计 16/16。唯一失败 K11：期待 `refund-policy:v2:deadline`，实际无结果。exit 0 只表示评测运行完成，并非全绿。当前关键词检索漏掉该问法；向量、混合检索和重排序未实现。

`pnpm -r typecheck`、`pnpm lint`、`pnpm -r test`、`git diff --check` 均 exit 0。现有测试 API 15/15、Web 6/6，不覆盖本节评测代码。未新增 `.test.ts`，未运行 build、未启动项目、未调用 DeepSeek。

手动验收：运行评测命令，核对总数 34、通过 33 和 K11；打开 Golden JSON 检查 K11 预期，再检查原始手册的 14 天规则。以后改变检索后复跑，确认 K11 与其他 33 条的变化。

## 6. 模拟面试

**Q1：Golden Dataset 是什么，怎么维护？** 推荐回答：固定输入和经业务确认的预期，用于对比版本变化；覆盖常见、边界和权限问题。追问：代码改了就改预期吗？不能，先判断需求是否真的变化。错误回答：“全绿就代表生产准确率 100%”。

**Q2：33/34 能说明 Agent 准确率是 97% 吗？** 推荐回答：不能。本次只测确定性检索与统计函数，未测 DeepSeek 工具选择、参数和最终生成。追问：真实 Agent 还要记录什么？工具调用、参数、事实、引用和任务结果。错误回答：“工具正确就等于模型正确”。

**Q3：K11 失败该怎么办？** 推荐回答：确认手册确有规则和标注，再分析检索为何漏召回；改动后用同一数据集复跑。追问：让模型猜 14 天可以吗？不行，缺证据应拒答。错误回答：“删掉失败样本”。

## 7. 复盘与下一课

1. K11 属于召回、引用还是统计错误？
2. 为什么 33/34 不能称作生产准确率？
3. 增加模型评测时，要分别检查哪些中间步骤和最终结果？

Git 建议只提交本节数据集、评测脚本和课程记录。Day 35 才处理 tracing；本轮停止。
