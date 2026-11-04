# Day 14：参数校验失败与有界自纠错

日期：2026-11-04。状态：**IN_PROGRESS**。前置：Day 12 的 Zod 工具参数和 Day 13 的服务端权限边界。本课只处理模型生成的工具参数错误；不实现通用重试框架或多步 Agent。

## 1. 目标与真实场景

主管问“查询演示订单 124 的状态”，模型可能提出 `getOrderDetail({orderId:124,view:"状态"})`。业务契约只允许 `view:"status"` 或 `"detail"`；直接执行会失败。Day 14 先观察这类参数失败，再允许模型额外修复一次。订单号缺失或越权不能靠模型猜测或重试。

这和 Day 13 不同：Day 13 判断**能否执行**，本课判断**格式错误是否值得修正一次**。修复仍可能失败，不能把成功当作保证。

## 2. 主流程与重点代码

原流程：`模型生成错误参数 → SDK 校验失败 → 工具错误 → 页面失败`。本课增加：`校验失败 → 修复资格检查 → 最多一次 DeepSeek 结构化修复 → 再次校验且订单号不变 → 执行原工具 → 模型回答`。

**修复资格**见 `apps/api/src/tool-repair.ts`：

```ts
export function repairableOrderId(toolName: string, rawInput: string, attempts: number): number | undefined {
  // 只允许修正订单查询的 view；编号本身缺失或无效时不得让模型猜。
  if (toolName !== "getOrderDetail" || attempts >= 1) return undefined;
  try {
    const input = repairableInput.safeParse(JSON.parse(rawInput));
    return input.success ? input.data.orderId : undefined;
  } catch {
    return undefined;
  }
}
```

**模型修复和结果再校验**见 `apps/api/src/model-provider.ts`：

```ts
const orderId = repairableOrderId(toolCall.toolName, toolCall.input, repairAttempts);
if (orderId === undefined) return null;
repairAttempts++;
const repaired = await generateText({
  ...requestOptions("仅修复工具参数中的 view。保留原订单号；只输出合法对象。", prompt, abortSignal),
  output: Output.object({ schema: getOrderDetailInputSchema }),
  maxOutputTokens: 128,
  prompt: `用户问题：${prompt}。原参数：${toolCall.input}。只把 view 改为 status、detail 或省略；orderId 必须保持 ${orderId}。`,
});
const args = getOrderDetailInputSchema.safeParse(repaired.output);
if (!args.success || args.data.orderId !== orderId) return null;
return { ...toolCall, input: JSON.stringify(args.data) };
```

同一次工具问答仍由 `stepCountIs(2)` 限制为“工具步骤 + 回答步骤”，第二步禁用工具；`repairAttempts >= 1` 限制**额外修复模型调用**最多一次。两者控制的对象不同。超时信号和 128 token 修复输出上限控制额外成本。权限拒绝由 `ToolAccessError` 直接终止，不进入参数修复。

## 3. 通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 只接受完整且再次通过 Schema 的修复参数；partial 不能执行。 |
| 工具参数与自我纠错 | 仅可恢复的 `view` 错误修一次；缺编号与权限拒绝停止。 |
| 上下文与 Token | 修复会增加一次真实模型调用；限制次数、输出 128 token 和总超时。 |
| HITL 与副作用安全 | 本课工具只读；写操作不能照搬自动修复后重试。 |
| 取消、断流与恢复 | 同一个 `AbortSignal` 覆盖原调用与修复；断线不能标记完成。 |

## 4. 本课专项五大深水坑

| 风险 | 处理与证据 |
| --- | --- |
| 相同错误无限修复 | `repairAttempts` 每请求最多 1；无服务检查第二次不可修。 |
| 权限拒绝被“改参数”绕过 | 仅 SDK 参数错误进入 `repairToolCall`；`ToolAccessError` 不修复。 |
| 模型修改订单号 | 修复前提取有效 `orderId`，修复后必须完全一致。 |
| 缺字段让模型猜 | 缺 `orderId` 不修；返回安全的参数提示。 |
| 未知工具当成可修参数 | 只允许 `getOrderDetail`；未知名称直接安全终止。 |

## 5. 实际测试与验收

无服务资格检查实际结果：`{orderId:124,view:"状态"}` 在第 0 次可修，返回订单号 124；缺编号、多余 `role`、未知工具、相同调用第 1 次均不可修。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）和 `git diff --check` 均 exit 0。现有测试不覆盖真实 SDK 修复事件；按用户要求未新增 `.test.ts`、未启动项目、未运行 build、未调用 DeepSeek 验证修复。

手动验收：

1. 在“工具问答”输入“查询演示订单 124 的状态”，正常应返回“待退款”；只有服务端 trace 记录无效首次参数和修复调用时，才能证明走过纠错路径。正确回答本身不证明发生了修复。
2. 用 SDK 调试或断点人为制造 `view:"状态"`，观察最多一轮修复，修复后的 `orderId` 仍为 124；本轮未做故障注入。
3. 输入缺订单号的问题，期望追问或安全提示，不能猜一个编号。问无权订单 130，期望拒绝，不能通过修复换成 124。
4. 记录一次修复的额外模型调用和耗时；本轮未取得真实调用指标。

## 6. 模拟面试

**Q1：`stepCountIs(2)` 是否表示最多修复两次？** 回答：不是。它限制主模型的工具和回答步骤；`repairAttempts` 单独限制额外修复模型调用次数。追问：修复会不会增加 token？会，额外的 `generateText` 产生输入和输出 token。错误回答：“两步就是两次重试。”

**Q2：为什么不能修复缺失的订单号？** 回答：模型没有可靠依据补出业务标识，猜测可能查询错误对象；应追问用户或停止。追问：已有正确订单号但 `view` 是中文时呢？可以修一次可选枚举，并校验订单号未改变。错误回答：“让模型随便补齐再试。”

**Q3：权限拒绝是否可以让模型换参数重试？** 回答：不能。权限是服务端不可恢复的安全决定；让模型改 ID 会绕开原始请求语义。追问：格式错误与越权的日志如何区分？记录错误类别、尝试次数和请求 ID，避免把敏感参数直接暴露给前端。错误回答：“所有工具错误都重试一次。”

## 7. 复盘与下一课

复盘：1. 主模型步骤和修复次数分别由什么限制？2. 哪些参数错误值得修、哪些必须追问？3. 为什么修复结果仍要再次校验并对比订单号？

Git 建议只提交修复资格、SDK 接线、课件和进度。Day 15 再处理工具执行失败、超时与重试幂等；本轮停在 Day 14。
