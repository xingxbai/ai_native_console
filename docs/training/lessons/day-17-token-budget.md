# Day 17：Token 预算与上下文裁剪

日期：2026-11-04。状态：**IN_PROGRESS**。前置：Day 16 页面上下文采集。本课只约束工具问答中由应用自行拼接的文本；会话历史留给 Day 18，真实供应商 Token 用量仍待观测。

## 1. 真实场景与概念

客服在订单页问“这条订单如何处理？”。系统规则、用户问题、页面所选订单和状态筛选都会占用模型输入空间；模型回答还需要输出空间。规则和问题不能随意截断，筛选条件最不重要，选中订单其次。预算不够时按此顺序舍弃；核心内容仍放不下，就在发起模型调用前拒绝。

本课给应用文本设 **512 个估算输入 token**，给模型回答预留 **1024 个输出 token**。估算采用“两 Unicode 字符约一 token”，仅是教学用的粗估，**不包含 SDK 自动注入的工具 Schema、协议开销，也不是 DeepSeek 实际计费值**。1024 与 provider 当前 `maxOutputTokens` 一致；不能据此宣称模型总上下文有硬上限保障。

## 2. 主流程与重点代码

`apps/api/src/context-budget.ts`：

```ts
const fits = (instructions: string) => estimateTokens(instructions) + estimateTokens(message) <= inputBudget;
if (!fits(base)) return { instructions: base, overBudget: true, /* 估算和省略项 */ };
const withSelection = base + selected;
const instructions = fits(withSelection + filter) ? withSelection + filter
  : fits(withSelection) ? withSelection : base;
```

完整代码还返回 `estimatedInputTokens` 与 `omitted`。`apps/api/src/app.ts` 在工具模式调用组装器：核心超预算返回 400；否则把预算、估算量和省略项写入服务端日志，只传组装后的指令给 provider。日志不记录问题正文或订单数据。实际 Token 使用量及人民币成本尚未采集，不能把估算日志当费用报表。

操作对照：保留同一问题和订单 123，把演示预算依次设为 35、30、24、5，观察 `omitted` 从 `[]` 到 `[filter]`、`[filter, selection]`，最后 `overBudget=true`。生产默认预算仍为 512。

## 3. 通用五大深水坑

| 深水坑 | 本课关联 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 相关：输出预留防止回答空间被应用文本挤占；结构化输出仍须最终校验。 |
| 工具参数与自我纠错 | 相关：工具 Schema 和修复调用也耗 Token，本课估算未计入。 |
| 上下文与 Token | 本课重点：优先级裁剪、输入估算、输出预留和日志。 |
| HITL 与副作用安全 | 暂不展开：不能为了省 Token 删除审批和权限规则。 |
| 取消、断流与恢复 | 相关：取消/断流不能据估算量推断真实消耗。 |

## 4. 本课专项五大深水坑

| 风险 | 触发、表现与原因 | 处理与验证 |
| --- | --- | --- |
| 把字符数当精确 Token | 中文、英文、工具 Schema 的分词不同，费用估错 | 明确标注估算；真实用量待接 provider usage，检查日志字段名为 `estimatedInputTokens`。 |
| 不预留输出 | 输入占满可用窗口，回答被截断 | 1024 输出预留与 provider 上限一致；检查配置。 |
| 先裁用户问题 | 问题关键条件丢失，答案偏题 | 只裁可选页面线索；核心超预算直接拒绝，5 单位操作已验。 |
| 筛选比订单 ID 优先 | “这条订单”失去指代对象 | 先去筛选再去选中 ID，30 与 24 单位操作已验。 |
| 日志记录完整上下文 | 预算排查导致隐私泄露 | 只记数字和省略字段名；检查 API 日志调用。 |

## 5. 实测与手动验收

已直接调用真实组装器：预算 35 时估算 35、省略 `[]`；30 时估算 26、省略 `filter`；24 时估算 7、省略 `filter` 与 `selection`；5 时 `overBudget=true`。Node 22 类型剥离提示实验性警告。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）和 `git diff --check` 均 exit 0；现有测试不覆盖预算组装器。未新增 `.test.ts`、未启动项目、未运行 build。

手动验收：选择订单 123、状态“已退款”，在工具模式问“这条订单状态是什么？”；服务端日志应有 `estimatedInputTokens`、`inputBudget:512`、`outputReserve:1024`、`omitted`。检查日志没有完整问题文本。现有短问题通常不会触发默认预算裁剪；上述可调预算的无服务操作用于观察裁剪过程。真实 DeepSeek usage 与费用尚未验收。

## 6. 模拟面试

**Q1：为什么 Token 预算不能只看用户输入长度？** 推荐回答：系统指令、页面上下文、工具 Schema、工具结果和模型输出都占空间；本项目目前只粗估应用拼接的文本并预留输出，完整用量尚未观测。追问：日志的 `estimatedInputTokens` 能当费用吗？答：不能，实际计费以供应商用量为准。错误答案：“500 字问题就是 500 token”，分词并非逐字等价。

**Q2：预算不够时先删什么？** 推荐回答：先删非关键筛选，再删选中 ID；用户问题和服务端规则不截断，仍超预算则拒绝。追问：删选中 ID 后“这条订单”怎么办？答：模型应要求明确编号，不能猜测。错误答案：“把所有文本截前 1000 字”，可能丢掉关键约束。

**Q3：如何验证节省 Token 没损害回答？** 推荐回答：对同一问题比较完整上下文与裁剪上下文的工具选择、订单 ID 和最终答案，记录实际 usage、延迟及错误率；本课仅验证了组装器的裁剪顺序。追问：已有真实模型对照吗？答：没有，待手动验收。错误答案：“估算数字变小就代表质量不变”，缺少任务结果证据。

## 7. 复盘

1. “这条订单”场景里，为什么订单 ID 比筛选条件重要？
2. `estimatedInputTokens` 为什么不能用于结算成本？
3. 核心问题超预算时为什么要拒绝，而不是悄悄截断？

Git 建议只提交组装器、调用处、课件和进度。Day 18 再处理多轮历史；本轮停在 Day 17。
