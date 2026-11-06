# Day 24：HITL 中断与审批卡片

日期：2026-11-06。状态：**COMPLETED（独立命令行预览）**。前置：Day 23 checkpoint。本课只生成待审批预览并暂停，不实现批准、拒绝、恢复、数据库写入或浏览器卡片；这些属于 Day 25 及后续集成。

## 1. 真实场景与目标

运营人员要求把订单 124 从“待退款”改为“已退款”。这属于有副作用的动作，不能让模型或图直接执行。服务端先读取订单版本，形成精确变更预览，连同申请人、所需审批角色、有效期和参数哈希交给审批界面；图在写操作前暂停。本课用固定演示订单验证这个暂停点，命令输出的 `approvalCard` 是页面以后可渲染的数据结构，**当前没有浏览器卡片**。

流程：`START → preparePreview → approval(interrupt) ⏸`。不接执行节点，也不接真实模型。

## 2. 重点代码与操作

见 `apps/api/src/day24-approval.ts`。图编译时接 `MemorySaver`，并传稳定的 `thread_id`：

```ts
const graph = new StateGraph(State)
  .addNode("preparePreview", (state) => ({ preview: {
    orderId: order.id, before: order.status, after: state.request.nextStatus,
    reason: state.request.reason, version: order.version,
  } }))
  .addNode("approval", (state) => {
    interrupt(state.preview);
    return {};
  })
  .addEdge(START, "preparePreview")
  .addEdge("preparePreview", "approval")
  .addEdge("approval", END)
  .compile({ checkpointer });
```

实际代码还检查订单 ID；片段只突出中断主线。`interrupt()` 暂停当前节点，`getState(config)` 的 `next` 是 `approval`，`tasks[].interrupts` 包含预览。审批卡片数据含 `runId`、`threadId`、申请主体、所需审批角色、动作前后值、原因、订单版本、SHA-256 参数哈希、15 分钟有效期和 `waiting_approval` 状态。`threadId` 只是定位图状态；`parameterHash` 只是防篡改比对依据，不能代替服务端授权或持久审批记录。

运行：

```bash
pnpm --filter @ai-native-console/api day24:approval
```

## 3. 通用五大深水坑

| 深水坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 当前卡片是服务端固定结构化数据，不渲染模型生成的 UI。 |
| 工具参数与自我纠错 | 动作输入用 Zod 校验；模型即使提出动作也不能跳过审批。 |
| 上下文与 Token | 本课不调用 DeepSeek；预览只含审批所需字段。 |
| HITL 与副作用安全 | 核心：先预览、再 `interrupt`；没有批准前 `executed=false`。 |
| 取消、断流与恢复 | MemorySaver 只在进程内；本课不提供 resume，重启会丢状态。 |

## 4. 本课专项五大深水坑

| 失效场景 | 风险与处理 | 验收 |
| --- | --- | --- |
| 先执行后审批 | 真实状态已改，审批失去意义 | `interrupt` 前没有写操作；订单仍“待退款”。 |
| 只显示“批准”按钮 | 审批人不知道具体改什么 | 预览含前后值、原因和版本。 |
| 审批绑定不上请求 | 重复或错单审批 | 卡片含 run/thread ID、申请主体、参数哈希；持久绑定留 Day 25。 |
| 把角色字符串当鉴权 | 任意人可伪装审批人 | `requiredApprover` 仅是展示要求；真实身份认证尚未实现。 |
| 暂停状态只在内存 | 重启后无法审批 | 明确使用 MemorySaver；生产持久化 ADR 在 Day 23。 |

## 5. 实际测试与验收

第一次运行因 LangGraph 1.7 不允许节点和状态字段同名而失败；改为 `preparePreview` 后，命令 exit 0。实际输出：订单 124 从“待退款”到“已退款”的预览、版本 3、`waiting_approval`、`next=["approval"]`、一个 interrupt、`executed=false`、`currentOrder.status="待退款"`。`pnpm -r typecheck` exit 0。`pnpm -r test` 为已有 API 15/15、Web 6/6，通过，但不覆盖本课。全仓 lint 首次因 Day 22 练习入口未使用导入而失败，删除该导入后复测。未新增 `.test.ts`，未启动项目或运行 build。

手动验收：运行命令，核对 `approvalCard.preview`、`interrupts[0].value`、`next`、`executed` 和 `currentOrder`；重复运行会生成新 runId，但演示订单仍不变。当前不是完整审批系统：没有前端卡片、持久待审批记录、真实用户认证或恢复执行。

## 6. 模拟面试

**Q1：为什么在高风险动作前调用 `interrupt()`？** 推荐回答：让图在执行副作用前暂停，给人看到精确动作预览；当前订单仍是旧状态。追问：前端显示按钮就足够吗？不够，后端恢复时仍要验证身份、参数版本和业务状态。错误答案：“模型说要审批就算审批完成”。

**Q2：审批预览为什么要带订单版本和参数哈希？** 推荐回答：审批针对某次特定动作和特定数据版本；后续恢复时可发现申请后参数或订单已变化。追问：哈希能代替鉴权吗？不能，哈希不证明谁有权批准。错误答案：“只存 `approved=true` 就够了”。

**Q3：`interrupt()` 与 HTTP 请求暂停是同一回事吗？** 推荐回答：不是。图把待继续状态交给 checkpointer，当前调用结束；以后通过受控 resume 重新进入图。MemorySaver 不能跨进程保留。追问：浏览器断线后重新连接 SSE 就能恢复审批吗？不能，SSE 事件重放和图恢复是不同机制。错误答案：“保持 HTTP 连接 15 分钟等主管点按钮”。

## 7. 复盘与下一课

1. 如果删掉 `interrupt(state.preview)`，订单为什么仍不会改变？这能证明什么，不能证明什么？
2. 审批人看到的前后值、版本和原因，分别防止哪类误操作？
3. 当前命令为什么不能当作生产审批系统？

Git 建议提交命令、课件和进度。Day 25 才实现恢复、拒绝和授权验收；本轮停在 Day 24。
