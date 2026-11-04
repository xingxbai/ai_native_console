# Day 15：工具异常、超时、重试与幂等

日期：2026-11-04。状态：**IN_PROGRESS**。前置：Day 13 的服务端工具边界和 Day 14 的参数修复。本课只给公网演示统计的**只读 GET** 增加执行保护，不实现写操作或 Agent 多步循环。

## 1. 目标与真实场景

运营问演示用户 1 的任务统计时，JSONPlaceholder 可能超时、返回 429/503 或返回坏数据。页面应区分“模型不可用”和“统计数据服务不可用”。只读 GET 可以有限重试；发送通知、改订单状态等写操作不能照搬重试，因为第一次可能已经成功。

验收口径：每次外部请求最多 5 秒，最多两次尝试，两次之间等待 200ms；仅网络失败、429 和 5xx 进入第二次尝试。普通 4xx、取消、参数/权限错误不重试。工具执行失败不得编造统计数字。

## 2. 主流程和重点代码

`模型选 getDemoTaskStats → Node 发只读 GET → 响应分类 → 必要时短退避再试一次 → Zod 校验 → 计算 20/11/9 → 模型回答`。若工具仍失败，API 发工具错误终态，页面显示数据服务错误。

**只读请求保护**见 `apps/api/src/tool-execution.ts`：

```ts
for (let attempt = 0; attempt < 2; attempt++) {
  const timeout = AbortSignal.timeout(5_000);
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
    if (response.ok) return await response.json();
    if (response.status !== 429 && response.status < 500) throw new ToolExecutionError("TOOL_UNAVAILABLE");
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof ToolExecutionError) throw error;
    if (attempt === 1) throw new ToolExecutionError(timeout.aborted ? "TOOL_TIMEOUT" : "TOOL_UNAVAILABLE");
  }
  if (attempt === 0) await delay(200, undefined, { signal });
}
```

`apps/api/src/demo-stats.ts` 只把取得的 JSON 交给原有 Zod Schema，然后计算汇总。`apps/api/src/app.ts` 将 `ToolExecutionError` 映射成独立 SSE 错误码；`apps/web/app/ask-panel.tsx` 显示中文数据服务错误。模型调用自己的重试仍为 `maxRetries: 0`，与工具 GET 的两次尝试是不同预算。

**幂等边界**：本课的 GET 不改变业务状态，重复读取是安全的，所以不需要写操作幂等键。未来若工具执行“修改订单”，必须由服务端生成/校验幂等键并记录执行状态；超时后不能因为没收到响应就假设第一次没成功。该写工具和执行记录尚未实现，不宣称已验证。

## 3. 通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 工具失败发送 SSE `error`，前端不能把已有文字当完成。 |
| 工具参数与自我纠错 | 格式修复只在 Day 14 的特定输入进行；权限/参数错误不进入网络重试。 |
| 上下文与 Token | 有限重试控制等待和模型成本；失败不把原始异常喂给模型猜数字。 |
| HITL 与副作用安全 | 只读 GET 可重试；写操作须幂等键、状态和必要审批。 |
| 取消、断流与恢复 | 用户取消信号与单次超时合并；取消后不再等待退避或发第二次请求。 |

## 4. 本课专项五大深水坑

| 风险 | 处理与验收 |
| --- | --- |
| 所有 HTTP 错误都重试 | 仅 429/5xx 值得再试；普通 4xx 立即失败。 |
| 网络超时无限等待 | 单次 5 秒、最多两次、间隔 200ms；外层工具模式仍有 40 秒总超时。 |
| 浏览器取消后还在请求 | 两次请求和退避都接收取消信号；已取消请求无服务检查返回 `AbortError`。 |
| 把工具失败当模型失败 | `TOOL_TIMEOUT/TOOL_UNAVAILABLE` 与模型错误码分开。 |
| 重试写工具造成重复副作用 | 当前只有只读 GET 使用此保护；写工具必须先有幂等键和执行状态。 |

## 5. 实际测试和手动验收

实际执行：在允许公网访问的环境直接调用 `getDemoTaskStats`，得到 `{total:20,completed:11,pending:9}`。对公开不存在路径和公开 503 状态接口执行读取，均返回 `TOOL_UNAVAILABLE`；已取消信号返回 `AbortError`。首次沙箱内公网调用因网络限制失败，随后按环境审批在可联网环境重跑成功。503 接口没有提供每次请求计数，**本轮没有直接证明恰好发出两次请求**；代码循环上限为两次。尚未验证真实 429、单次 5 秒超时或浏览器工具错误呈现。

`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）及 `git diff --check` 均 exit 0。未新增 `.test.ts`，未启动项目，未运行 build，未调用 DeepSeek 验证工具失败链路。

手动验收：在“工具问答”询问演示用户 1 的任务统计，正常应得到 20/11/9（以公网当次数据为准）。数据源故障时页面应显示“数据服务暂时不可用”或“数据查询超时”，不能显示“模型暂时不可用”，也不能给出猜测统计。服务端需记录请求 ID、工具名、尝试次数和错误类别后才能证明真实重试次数；本课尚无该 trace 面板。

## 6. 模拟面试

**Q1：为什么 503 可以重试，400 不重试？** 答：503 通常表示暂时性服务故障；400 往往是请求无效，原样重试不会变好。追问：429 该怎么处理？可按 `Retry-After` 或服务端预算有限退避；本课固定 200ms 只作教学基线。错误答案：“所有失败都重试三次。”

**Q2：工具超时后重试写订单接口安全吗？** 答：不安全。第一次请求可能已提交但响应丢失，直接重试可能重复写。应带稳定幂等键并查询/记录执行状态，必要时做审批和补偿。追问：`AbortController` 能回滚吗？不能，它只取消等待和后续工作。错误答案：“超时就证明第一次没成功。”

**Q3：如何区分模型故障和工具故障？** 答：在执行边界使用不同错误类型，SSE 带不同机器码，页面显示对应安全文案；服务端用请求 ID 关联日志。追问：能把外部接口错误原文直接给模型或用户吗？通常不能，可能泄露地址、令牌或内部结构。错误答案：“统一显示模型不可用即可。”

## 7. 复盘与下一课

复盘：1. 哪些状态值得重试，哪些应立即停止？2. 为什么只读 GET 与修改订单的重试策略不同？3. 如何证明真正发生了两次请求，而不只是代码里写了循环？

Git 建议只提交工具执行保护、错误契约、页面文案、课件和进度。Day 16 才进入前端上下文采集；本轮停在 Day 15。
