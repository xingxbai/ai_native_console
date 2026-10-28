# Day 07：AbortController 与 Node.js 取消传播

日期：2026-10-28。状态：代码与静态检查完成；运行时断连验收待执行。按用户要求，本课没有启动项目、运行 build 或新增 `.test.ts`。

## 1. 目标、前置与完成定义

前置：Day 05 的 SSE 流和 Day 06 的消息状态。目标是从浏览器“停止”按钮把取消传到 Next 代理、Fastify，再传到 DeepSeek SDK；正常完成仍须收到 `done`。完成定义分两层：代码链路和静态检查已完成；真实运行下的停止、卸载和断连还需手动验收，不能据此声称供应商必然停止计费。

## 2. 概念与数据流

```text
点击停止 / 页面卸载 -> 浏览器 AbortController.abort()
  -> Next 响应流取消 -> 上游 fetch AbortController.abort()
  -> Fastify 响应提前 close -> 模型 AbortSignal
  -> AI SDK / DeepSeek 请求中止
```

浏览器 `abort()` 只直接控制浏览器请求；后两层需要显式传递。Fastify `close` 也可能在正常完成后发生，所以用 `reply.raw.writableFinished` 区分正常结束与提前断开。模型 20 秒超时与用户取消合并成一个信号，但错误归类不同：超时是失败，主动取消不是模型故障。SSE 的 `done` 才代表完整回复；点击“停止”保留已有片段并显示“已停止”。

## 3. 代码与操作

| 文件 | 关键流程 |
| --- | --- |
| `apps/web/app/ask-panel.tsx` | 每次请求创建 AbortController；停止或卸载时 abort，阻止迟到 delta 覆盖取消态 |
| `apps/web/app/page.tsx`、`apps/web/app/navigation-check/page.tsx` | 提供站内切换和返回入口，用于观察组件卸载后的取消行为 |
| `apps/web/app/api/chat/stream/route.ts` | 浏览器请求中止或下游流取消时，终止到 Fastify 的 fetch；移除信号监听器 |
| `apps/api/src/app.ts` | 响应提前 close 才 abort 模型，正常完成不误判；流结束清理监听器 |
| `apps/api/src/model-provider.ts` | 把外部 signal 和 20 秒 deadline 合并，交给 `streamText` |

### 本课重点代码

**1. 浏览器创建请求信号，并在停止时锁定状态。** 来源：`apps/web/app/ask-panel.tsx`。`readStreamReply` 的回调也检查 `signal.aborted`，避免迟到的文本覆盖取消态；组件卸载时调用同一个 controller 的 `abort()`。

```tsx
const controller = new AbortController();
activeRequest.current = { id, controller };
const response = await fetch("/api/chat/stream", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: input }),
  signal: controller.signal,
});

function stop() {
  const active = activeRequest.current;
  if (!active) return;
  // 先锁定界面终态，再中断请求，避免迟到的 delta 覆盖“已停止”。
  updateExchange(active.id, { status: "cancelled" });
  active.controller.abort();
}
```

**2. Next 代理既监听浏览器请求，也处理浏览器停止读取响应。** 来源：`apps/web/app/api/chat/stream/route.ts`。上游 `fetch` 使用 `controller.signal`；下游流的 `cancel()` 是浏览器停止消费后的另一条取消入口。

```ts
const controller = new AbortController();
const onAbort = () => controller.abort();
request.signal.addEventListener("abort", onAbort, { once: true });
// 上游 fetch 的 signal: controller.signal

const body = new ReadableStream<Uint8Array>({
  async pull(stream) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        cleanup();
        stream.close();
      } else {
        stream.enqueue(value);
      }
    } catch (error) {
      cleanup();
      stream.error(error);
    }
  },
  cancel() {
    // 浏览器停止读取响应时，终止到 Fastify 的请求。
    controller.abort();
    cleanup();
    return reader.cancel();
  },
});
```

**3. Fastify 只在响应提前关闭时取消模型。** 来源：`apps/api/src/app.ts`。正常完成也可能触发 `close`，因此必须检查 `writableFinished`；`stream` 关闭时移除监听器。

```ts
const controller = new AbortController();
const onClose = () => {
  // 正常完成也会触发 close；只有响应提前断开才取消模型。
  if (!reply.raw.writableFinished) controller.abort();
};
reply.raw.once("close", onClose);

for await (const text of provider.streamReply(SYSTEM_INSTRUCTIONS, message, controller.signal)) {
  yield frame({ type: "delta", text });
}
if (controller.signal.aborted) return;
yield frame({ type: "done", requestId });
```

**4. DeepSeek 请求合并取消与超时，但保留不同的错误归因。** 来源：`apps/api/src/model-provider.ts`。外部取消不应被误报成 20 秒模型超时。

```ts
const timeoutSignal = AbortSignal.timeout(20_000);
const abortSignal = AbortSignal.any([signal, timeoutSignal]);
try {
  const result = streamText(requestOptions(instructions, prompt, abortSignal));
  for await (const text of result.textStream) {
    if (text) yield text;
  }
} catch (error) {
  if (timeoutSignal.aborted && !signal.aborted) throw new ModelTimeoutError();
  throw error;
}
```

片段聚焦取消路径，省略了输入校验、事件长度限制和完整清理代码；真实行为以对应源码为准。

用户在已有运行环境打开页面，提交需要较长回答的问题，看到片段后点“停止”。应显示“已停止”，片段保留，不再出现“已完成”。再提新问题，确认可正常完成。用浏览器 Network 查看第一个请求处于取消状态；关闭页面或导航离开时也应停止浏览器请求。要确认 Fastify 和 DeepSeek 的实际停止时间，需观察服务端日志或供应商侧请求记录；本轮没有运行这一步。

站内切换验收：在首页提交一个较长问题，回复仍在生成时点击页头“切换页面”，进入 `/navigation-check`，再点“返回提问”。切走时 `AskPanel` 卸载，其清理函数调用 `abort()`；返回后组件重新挂载，内存里的提问记录会重置。观察 Network 中原 SSE 请求是否被取消。这个操作只验证页面侧的卸载路径；Fastify 和 DeepSeek 是否及时停止仍要结合服务端与供应商记录确认。页面入口和课件已加入，本轮未启动项目执行此操作。

## 一、通用五大深水坑

| 深水坑 | 本课边界 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 取消后只保留纯文本片段，不把它当最终结构化对象；Day 08–10 再处理部分 JSON 与 UI。 |
| 工具参数与自我纠错 | 当前没有工具；以后取消不能让已开始的副作用自动回滚。 |
| 上下文与 Token | 停止请求可能减少后续生成，但已生成 token 和费用不能撤销。 |
| HITL 与副作用安全 | 已停止的回答不能成为审批结论；当前没有业务写操作。 |
| 取消、断流与恢复 | 主动取消、模型超时和网络断流是不同终态；本课不实现断线重放，留给 Day 30。 |

## 5. 本课专项五大深水坑

| 场景 | 影响和处理 | 验收点 |
| --- | --- | --- |
| 只在浏览器 abort | 后端与模型可能继续生成；逐层传递取消信号 | 停止后检查服务端和供应商行为 |
| 把所有 close 当中断 | 正常结束也会 close；检查 `writableFinished` | 正常回复仍到 `done` |
| 取消后迟到 delta 覆盖状态 | 页面看似重新开始生成；回调检查 signal | “已停止”保持不变 |
| 把用户取消记成超时 | 错误归因和提示混乱；用超时 signal 区分 | 停止显示“已停止”而非“超时” |
| 监听器未清理 | 长会话可能积累监听器；流结束移除 | 多次请求后无重复触发 |

## 6. 测试结果与验收清单

本课实际运行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test` 与 `git diff --check`，均 exit 0；现有 API 15/15、Web 6/6 测试通过。本轮不启动项目、不运行 build。现有 21 个测试覆盖旧配置与 API 基础契约，不覆盖新的取消传播；不能把它们当作运行时断连验证。

- [x] 页面有“停止”按钮和取消终态；前端、代理、Fastify、模型 provider 的信号路径已连接。
- [x] 正常完成仍由 `done` 决定，用户取消不会把片段标为完成。
- [ ] 运行时点击停止后，观察浏览器、Fastify 和供应商侧是否及时停止。
- [ ] 页面卸载、直接断网、重复点击停止及正常完成均做实际运行验收。

## 7. 排查

点停止后仍出现新文字：检查 delta 回调是否在 `signal.aborted` 后更新状态。浏览器请求已取消但模型仍生成：检查 Next 响应流的 `cancel()` 与 Fastify 提前 `close`。正常回答被误报取消：检查 `writableFinished`；不要把 `close` 单独当作异常。没有 `done` 却显示完成：检查客户端终态判定。

## 三、模拟面试真实考场

### Q1：前端 AbortController 能保证服务端和模型停止吗？

**回答：** 不能单凭前端 abort 保证。它先中断浏览器 fetch；代理要取消上游读取，Fastify 要把响应提前关闭转换为 signal，SDK 再把信号传给供应商。代码接通后仍需运行时观察各层，尤其不能承诺已发生的费用会退回。**追问：HTTP 响应头已发时如何处理？** 不再改状态码，主动取消只关闭流；正常结果仍要 `done`。**错误答案：**“浏览器关闭就一定停模型且不计费”。

### Q2：为什么不能在 Fastify 的每次 `close` 都取消？

**回答：** 正常响应结束也会触发 close。用 `reply.raw.writableFinished` 判断是否提前断开，只在未正常写完时 abort 模型；完成后清理监听器。**追问：如果模型先结束而客户端读得慢？** 应区分模型完成和响应传输完成，不能靠 close 一项推断模型状态。**错误答案：**“close 等同请求被用户取消”。

### Q3：如何区分取消、超时和异常 EOF？

**回答：** 用户点击停止产生主动取消态，保留片段；20 秒模型 deadline 是超时错误；没有 `done` 的 EOF 是不完整流。三者都不能标成功，但用户提示、日志归因不同。**追问：取消后可以恢复同一模型任务吗？** 当前没有 checkpoint 或事件重放，只能重新发起请求；恢复与幂等留给后续课程。**错误答案：**“收到过 delta 就算成功”。

## 9. 复盘与下一课

请回答：1. 浏览器 abort 后还需要哪两层传递？2. 正常 close 与提前断开的区别是什么？3. 停止后为何不能承诺零费用？Git 提交建议仅包含取消链路与课程文档，不包含 `.env.local`。下一课是 Day 08 Partial JSON；本课不提前实现。
