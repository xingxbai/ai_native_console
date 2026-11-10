# Day 35：Tracing、日志、Token 与延迟指标

日期：2026-11-10。状态：**IN_PROGRESS**。Day 28 已延期，Day 34 的固定评测集是本课的观测对象。只实现本地评测的最小 trace 与命令行汇总；真实模型 Token、生产日志平台和可视化面板尚未接入。

## 1. 场景与目标

运营发现一个问题答错，开发者需要定位是哪次运行、哪条用例、哪个操作失败，耗时多少。Day 34 只给通过数；本课为每次评测生成 `runId`，为每条用例输出一个 span，按同一 ID 串起汇总与明细。运行 `pnpm --filter @ai-native-console/api day34:evaluate` 即看到命令行观测报告。

阅读顺序：`docs/training/evals/day-34-golden.json` → `apps/api/src/day34-evaluate.ts` → 失败用例对应的业务函数。重点代码：

```ts
const runId = randomUUID();
const started = performance.now();
// 每条用例结束后只记录 ID、操作、耗时和结果。
spans.push({ runId, caseId: item.id, kind: item.kind,
  operation: item.kind === "knowledge" ? "answerFromKnowledge" : item.tool,
  durationMs: Math.round((performance.now() - started) * 100) / 100, outcome });
```

`runId` 是本次评测的关联 ID，span 是一次业务函数调用记录；这里没有跨服务分布式 trace。`p95` 取 34 个耗时排序后的第 95 百分位样本。`tokenUsage: null` 表示没有模型调用，不能填 0 冒充真实模型成本。报告不输出问题全文、工具参数或业务返回值。

## 2. 通用五大深水坑

| 坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 只量最终业务调用耗时；首 token 和渐进 UI 尚未测。 |
| 工具参数与自我纠错 | span 不记录原始参数；真实模型纠错轨迹尚未接入。 |
| 上下文与 Token | Token 不可得时记 null，不能把字符估算当账单用量。 |
| HITL 与副作用安全 | 本地评测只读；审批审计不能只靠普通 trace。 |
| 取消、断流与恢复 | 本课未测断流；取消应有独立结果类别。 |

## 3. 本课专项五大深水坑

| 坑 | 判断与处理 |
| --- | --- |
| 记录完整 Prompt 泄露数据 | span 只留固定 caseId 和操作名。 |
| 混淆运行成功与用例通过 | 命令 exit 0 表示报告产出；K11 仍失败。 |
| 把本地 p95 当模型延迟 | 本次只调用本地检索/统计，注明测量范围。 |
| 缺关联 ID 找不到明细 | summary 与每个 span 共用 runId。 |
| 把 Token 缺失记成 0 | `null` 明确表示未采集。 |

## 4. 实测与验收

2026-11-10 实际运行评测命令：runId `310bcb93-b463-4583-a314-4147eccf3975`，34 条、33 通过、1 失败，错误率 1/34（约 2.94%），本地 p95 **16.78 ms**；K11 为 `EXPECTATION_MISMATCH`，Token `null`。每次运行耗时会变化，不能把该数字写成稳定性能结论。`pnpm -r typecheck`、`pnpm lint`、`pnpm -r test` 均通过；现有 API 15/15、Web 6/6 测试不覆盖新 trace。未新增 `.test.ts`，未启动项目、未运行 build。

手动验收：运行评测命令；确认 `summary.runId` 与 34 个 span 的 `runId` 一致，K11 的 span 为 failed 且有错误类别；搜索输出不应含 K11 的完整问题或工具参数。命令行 JSON 是本课最小观测面，不是生产监控面板。

## 5. 模拟面试

**Q1：run、trace、span 分别是什么？** 推荐回答：run 是一次业务执行；trace 把相关步骤关联起来；span 记录其中一个操作的时间和结果。本课一个评测 run 下有 34 个调用 span。追问：这算分布式 trace 吗？不算，没有跨服务上下文传播。错误回答：“打印一行日志就是完整 tracing”。

**Q2：Token 用量拿不到时怎么报告成本？** 推荐回答：标记为未知，记录可得的模型 usage 后再按模型价格计算；不要用字符数冒充账单 Token。追问：本次 `null` 是 0 Token 吗？不是，表示此评测没有采集模型 usage。错误回答：“估一下就当真实成本”。

**Q3：为什么日志不能直接写工具输入输出？** 推荐回答：可能含个人资料、密钥或业务数据；默认只记关联 ID、操作、耗时、结果和错误类别，需要排障时通过受控采样与脱敏获取细节。追问：只做字符串替换脱敏够吗？不够，还要控制字段、访问和保留期限。错误回答：“日志只给内部看所以不用管”。

## 6. 复盘

1. K11 的 runId、span 和错误类别分别帮你定位什么？
2. 为什么 16.78 ms 不能证明 DeepSeek 很快？
3. 真实模型接入时，你会在哪一步采集 usage 和首 token 时间？

Git 建议只提交本课观测记录和课件。Day 36 才讨论降级与限流；本轮停止。
