# Day 23：Checkpoint、thread_id 与持久化边界

日期：2026-11-06。状态：**COMPLETED（内存 checkpoint 练习）**。前置：Day 20 会话隔离、Day 21–22 图与工具。本课只演示状态保存和隔离，不接入页面，不实现审批、resume 或生产数据库。

## 1. 真实场景与目标

客服查订单后，业务流程可能等待后续操作。下次请求要找到**同一条图运行线**的状态，需要稳定的 `thread_id` 和 checkpointer。Day 23 先验证：同线程可以读取旧状态；另一线程不能误读；知道线程 ID 不等于有权访问；内存状态在新进程中消失。生产方案见 [ADR](../adr/day-23-checkpoint-persistence.md)。

## 2. 重点代码与操作

`apps/api/src/day23-checkpoint.ts` 是独立命令，不调用 DeepSeek。`queries` 使用 reducer 累加，图编译时接上 checkpointer：

```ts
const State = Annotation.Root({
  orderId: Annotation<number>,
  queries: Annotation<number>({ reducer: (old, next) => old + next, default: () => 0 }),
});
const graph = new StateGraph(State)
  .addNode("recordQuery", () => ({ queries: 1 }))
  .addEdge(START, "recordQuery")
  .addEdge("recordQuery", END)
  .compile({ checkpointer: new MemorySaver() });
```

同一 `thread_id` 调用两次，`queries` 从 1 到 2。`getState` 可读最新 checkpoint；只换 `thread_id`，读到空状态。调用前的归属判断是服务端职责：

```ts
function configFor(threadId: string, actor: string) {
  if (owners.get(threadId) !== actor) throw new Error("无权访问该线程");
  return { configurable: { thread_id: threadId } };
}
```

这里的 `owners` 仅用于单进程学习；不是生产鉴权。执行：

```bash
pnpm --filter @ai-native-console/api day23:checkpoint
pnpm --filter @ai-native-console/api day23:checkpoint inspect
```

第二条是全新 Node 进程，只读取同一个 `thread_id`，应为空。重新执行第一条仍从零开始。与 Day 22 的订单图相比，本课单独用无模型图让 checkpoint 行为可观察；Day 22 图尚未配置 checkpointer。

## 3. 通用五大深水坑

| 深水坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 本课无 SSE；前端事件重放与 checkpoint 恢复是两件事。 |
| 工具参数与自我纠错 | 本课无工具；checkpoint 不能替代工具 Schema、权限检查。 |
| 上下文与 Token | 图状态可能包含敏感上下文；持久化前需最小化与保留期限。 |
| HITL 与副作用安全 | 后续审批要保存审批身份和参数版本；有 checkpoint 仍不能自动执行写操作。 |
| 取消、断流与恢复 | MemorySaver 只在本进程可读取；断线、重启和多实例恢复各需单独设计。 |

## 4. 本课专项五大深水坑

| 失效场景 | 触发与后果 | 本课处理 / 验收 |
| --- | --- | --- |
| 没传 `thread_id` | 无法稳定定位同一线程 | 两次调用都传同一 `configurable.thread_id`；结果计数 2。 |
| 用 `thread_id` 当密码 | 别人猜到 ID 就能读状态 | 读取前校验服务端 owner；`bob` 被拒绝。真实认证未实现。 |
| 跨线程串状态 | A 的数据出现在 B | 换线程 `getState` 为空。 |
| 把 MemorySaver 当持久库 | 重启或多实例丢状态 | 新实例及独立进程 `inspect` 均为空。 |
| 把 checkpoint 当聊天或 SSE 历史 | 无法补发 UI 事件或审核动作 | ADR 明确四种记录的职责；本课不声称恢复能力。 |

## 5. 实际测试与验收

实际执行 `pnpm --filter @ai-native-console/api day23:checkpoint`，exit 0，输出同线程 `{ orderId: 123, queries: 2 }`、另一线程 `{}`、越权“无权访问该线程”、新内存实例 `{}`。随后独立运行 `day23:checkpoint inspect`，exit 0，输出 `{}`，证实新 Node 进程没有旧状态。`pnpm --filter @ai-native-console/api typecheck` exit 0；`pnpm -r test` exit 0（API 15/15、Web 6/6，已有测试不覆盖本课）；`pnpm lint` exit 1，原因是当前 Day 22 练习入口保留一个未使用的导入，与本课文件无关。未新增 `.test.ts`，未启动项目或运行 build。

手动验收：运行两条命令，核对四种输出；在 `day23-checkpoint.ts` 把第二次调用的线程 ID 改成新值再运行，观察原线程计数是否仍为 1；还原后再次运行。真正的跨实例持久恢复、认证用户及审批恢复尚未实现。

## 6. 模拟面试

**Q1：`thread_id` 和 checkpoint 分别做什么？** 推荐回答：`thread_id` 定位一条图运行线，checkpointer 保存该线程的图状态；同 ID 的下一次调用可以读到上次状态。追问：知道 ID 就能读吗？不能，服务端还要查 owner/tenant。错误答案：“`thread_id` 就是鉴权 token”。

**Q2：为什么 MemorySaver 不能用于重启恢复？** 推荐回答：它的数据只在当前 Node 进程的内存里；新进程新实例没有旧数据。本课 `inspect` 在独立进程读到空。追问：多实例部署会怎样？同一个请求落到另一实例也可能读不到。错误答案：“有 checkpoint 就一定能持久恢复”。

**Q3：checkpoint 和聊天记录、SSE 事件有什么区别？** 推荐回答：checkpoint 记录图节点继续运行需要的状态；聊天记录服务对话展示/上下文；SSE 事件用于给页面重放已发送的更新。三者不能互相替代。追问：断线重连后只传 Last-Event-ID 能恢复审批图吗？不能，还需要持久 checkpoint、授权与安全 resume。错误答案：“浏览器能重连就说明 Agent 从断点继续”。

## 7. 复盘与下一课

1. 为什么两次调用使用同一个 `thread_id` 后 `queries` 是 2？
2. 为什么另一个用户知道 `thread_id` 仍不能读状态？
3. 为什么独立进程 `inspect` 返回空，生产上应换什么存储？

Git 建议只提交本课命令、ADR、课件及进度。Day 24 才引入中断和审批卡片；本轮停在 Day 23。
