# Day 08：Partial JSON 与结构化数据渐进解析

日期：2026-10-28。状态：**IN_PROGRESS**。代码、类型与协议操作验收已完成；学习者提供了真实 DeepSeek 渐进事件和原页面完成截图。新增三列表格及失败路径仍待浏览器验收。按用户要求没有启动项目、运行 build 或新增 `.test.ts`。

## 1. 目标、前置与完成定义

前置是 Day 05 的 SSE 帧解析、Day 06 的消息状态和 Day 07 的取消信号。目标是在真实工程问题上逐步显示“摘要 / 风险 / 下一步”，并把**部分字段预览**与**最终可信对象**分开。只有 DeepSeek 结束、完整 Schema 校验通过、客户端收到 `analysis_done`，才算完成。本课不实现 Day 10 的 Generative UI 组件注册表，也不执行模型提出的任何业务动作。

## 2. 概念：两层 JSON，不要混淆

每个 SSE `data:` 仍是一条**完整** JSON 事件，等帧结束后才能 `JSON.parse`。事件中的 `partial.value` 是 SDK 从**尚未生成完的模型 JSON**提取的部分对象。`JSON.parse('{"summary":"审批前')` 会失败，因为原始 JSON 尚未闭合；AI SDK 7 的 `Output.object()` + `partialOutputStream` 可逐步给出已可解析的字段。部分对象即使能显示，也可能缺字段、后续变化或最终不合法。

```text
DeepSeek 结构化输出 -> AI SDK partialOutputStream -> partial SSE -> 页面预览
DeepSeek 完成 -> result.output -> 完整 Zod Schema -> analysis_done SSE -> 页面完成
```

当前 `summary/risk/action` 是工程分析文本，不代表读取了真实订单、文档或业务权限。文本问答模式仍存在；页面切换“文本问答 / 结构化分析”只改变响应形状，两种模式都调用真实 DeepSeek。

## 3. 重点代码与文件

| 文件 | 作用 |
| --- | --- |
| `packages/contracts/src/index.ts` | 请求增加 `format`；定义部分/完整分析 Schema 和 SSE 事件 |
| `apps/api/src/model-provider.ts` | DeepSeek `streamText` + `Output.object`；迭代 `partialOutputStream`，最终校验 `result.output` |
| `apps/api/src/app.ts` | 复用现有 SSE 路由，按 format 发 `delta/done` 或 `partial/analysis_done` |
| `apps/web/lib/sse.ts` | 校验事件模式、顺序和终态；部分对象只传给预览回调 |
| `apps/web/app/ask-panel.tsx` | 用三列表格逐步填充三个字段；完整结果才标“最终对象已校验” |

**模型侧：部分对象与最终对象分开。** 以下摘自 `model-provider.ts`，省略超时与错误映射：

```ts
const result = streamText({
  ...requestOptions(instructions, prompt, abortSignal),
  output: Output.object({ schema: analysisSchema }),
});
// partialOutputStream 的对象仅供预览，最终结果仍必须完整校验。
for await (const value of result.partialOutputStream) {
  const parsed = partialAnalysisSchema.safeParse(value);
  if (parsed.success && !signal.aborted) yield { type: "partial" as const, value: parsed.data };
}
if (signal.aborted) return;
if (await result.finishReason !== "stop") throw new ModelOutputLimitError();
const final = analysisSchema.safeParse(await result.output);
if (!final.success) throw new ModelOutputLimitError();
yield { type: "final" as const, value: final.data };
```

**协议侧：不同模式有不同终态。** 以下摘自 `app.ts`：

```ts
if (format === "analysis") {
  for await (const event of provider.streamAnalysis(ANALYSIS_INSTRUCTIONS, message, controller.signal)) {
    if (event.type === "partial") yield frame({ type: "partial", value: event.value });
    else yield frame({ type: "analysis_done", value: event.value, requestId });
  }
} else {
  for await (const text of provider.streamReply(SYSTEM_INSTRUCTIONS, message, controller.signal)) {
    yield frame({ type: "delta", text });
  }
  if (!controller.signal.aborted) yield frame({ type: "done", requestId });
}
```

**浏览器侧：预览不触发完成。** 以下摘自 `sse.ts`：

```ts
if (event.type === "partial") {
  if (format !== "analysis") throw new Error("Unexpected partial event");
  // 不完整字段只传给预览，不能作为最终可信对象。
  onPartial(event.value);
} else if (event.type === "analysis_done") {
  if (format !== "analysis" || event.requestId !== requestId) throw new Error("Invalid analysis completion");
  analysis = event.value;
  completed = true;
}
```

**页面侧：同一个结构化对象填入固定表格。** 以下摘自 `ask-panel.tsx` 的关键单元格：

```tsx
<table aria-label="结构化分析结果">
  <thead><tr><th scope="col">摘要</th><th scope="col">风险</th><th scope="col">下一步</th></tr></thead>
  <tbody><tr>
    {/* partial 是字段快照，单元格直接替换内容；缺失字段仍显示占位。 */}
    {(["summary", "risk", "action"] as const).map((key) => (
      <td key={key}>{(item.analysis ?? item.partial)?.[key] ?? "生成中"}</td>
    ))}
  </tr></tbody>
</table>
```

表格只有一行，对应本课的一个分析对象；`partial` 每次是完整的当前快照，不是新增一行。实际页面给表格设置固定列宽，手机宽度可横向滚动。生成中的字段只是预览，`analysis_done` 到达后才用最终对象覆盖。

## 一、通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 网络 chunk、SSE 事件、模型部分 JSON 是三层不同边界；只渲染固定文本字段，不接收模型 HTML/JSX。 |
| 工具参数与自我纠错 | 结构化 Schema 通过仍不是执行许可；当前没有工具。 |
| 上下文与 Token | 输出仍受 1024 token 和 20 秒限制；截断时拒绝最终对象。 |
| HITL 与副作用安全 | 部分或最终分析都不直接修改订单；未来写操作需权限和审批。 |
| 取消、断流与恢复 | 取消或 EOF 前未收到 `analysis_done` 就不是成功；Day 07 运行时取消验收仍待完成。 |

## 5. 本课专项五大深水坑

| 场景 | 错误做法与后果 | 当前处理 / 验收 |
| --- | --- | --- |
| 每个网络 chunk 直接 `JSON.parse` | 半个 UTF-8 字符或半行 SSE 就报错 | 原 SSE parser 先组帧；1–20 字节拆分 20/20 通过 |
| 把 SSE `data` 与模型部分 JSON 混为一谈 | 误以为每个 `data` 都是不完整 JSON | 每个 SSE 事件完整校验；`partial.value` 才是部分对象 |
| 部分对象作为最终结果 | 缺字段时仍写入业务系统 | `partialAnalysisSchema` 仅预览，`analysisSchema` 校验最终对象 |
| 断流或长度截断后标成功 | 用户误用半截分析 | 必须有 `analysis_done`；非 `stop` 结束拒绝完成 |
| 模型输出字段越界或内容虚构 | 结构合法不等于事实可信 | 字段长度和类型受 Schema 约束；无业务数据时仅为讨论建议 |

## 6. 实际检查与手动验收

本轮实际执行：`pnpm lint` exit 0、`pnpm -r typecheck` exit 0、`pnpm -r test` exit 0（现有 API 15/15、Web 6/6）、`git diff --check` exit 0。已有 21 个测试不覆盖结构化生成；未运行 build，运行时工作区的旧 `dist` 契约也未刷新。用 Node 直接导入共享契约源码操作验证：部分对象 `partialPreview=true`、`partialIsFinal=false`、完整对象 `finalValid=true`、未闭合原始 JSON 的 `JSON.parse` 返回失败；构造 `start/partial/analysis_done` SSE，按 1–20 字节拆分，20/20 组帧及事件 Schema 校验通过。首次 `tsx -e` 因本机 IPC 权限失败，改用 `node --import tsx` 后通过；没有把失败命令记作通过。

- [x] 部分对象与最终对象的 Schema 边界通过操作验收。
- [x] 结构化 SSE 事件按 1–20 字节切分，20/20 解析成功。
- [x] 学习者提供的真实 DeepSeek 响应含 102 个 `partial` 和最终 `analysis_done`，页面截图显示三字段与“最终对象已校验”；证据来自此前的段落展示。
- [ ] 本次新增三列表格尚未做浏览器视觉验收。
- [ ] 浏览器中途停止或断流时，片段保留且不显示“最终对象已校验”。
- [ ] 非法最终对象、空流与供应商中途故障的运行时路径尚未注入验证。

在已有运行环境打开首页，选择“结构化分析”，输入“运营要批量修改订单状态，给出摘要、一个风险和下一步”，观察表格的一行三列逐步填充，完成后出现“最终对象已校验”。手机宽度检查表格可横向滚动且文字不溢出。再试“文本问答”，确认原有纯文本路径仍能工作。可用 Network 检查 `partial` 与 `analysis_done`。

## 7. 排查

一直没有部分字段：检查 DeepSeek 是否按 Schema 生成，以及 SDK 是否产出 `partialOutputStream`；不是所有 token 都能形成可解析字段。出现预览后变失败：检查 `finishReason`、最终 `result.output` 和 `analysis_done`；预览本来就不保证成功。文本模式收到 `partial`：说明协议模式混淆，客户端应拒绝。`JSON.parse` 报错：先确认解析的是完整 SSE `data`，还是未闭合的模型原始 JSON。

## 三、模拟面试真实考场

### Q1：为什么不能对每个 chunk 直接 `JSON.parse`？

**推荐回答：** 网络 chunk 是任意字节段，可能切在 UTF-8 汉字、SSE 行或模型 JSON 字符串中。先用增量解码器组完整 SSE 事件，再解析事件 `data`；模型生成的部分对象交给 SDK 的 `partialOutputStream`。本课把结构化 SSE 按 1–20 字节切分，20 种都还原成功。**追问：SSE `data` 是 partial JSON 吗？** 本项目不是；每个 `data` 都是完整 JSON 事件，其 `value` 才可能是部分业务对象。**错误答案：**“`reader.read()` 每次都会给完整 JSON”。

### Q2：部分对象已经有 `summary`，为什么不能写入数据库？

**推荐回答：** 还缺 `risk/action`，后续输出也可能改变或失败；部分对象只用于视觉预览。最终对象必须等模型正常结束、完整 Zod Schema 校验，并收到 `analysis_done`。即便如此，内容仍是模型建议，业务写入还需权限和审批。**追问：完整 Schema 通过就能执行吗？** 不能，Schema 只校验形状，不代表事实和授权。**错误答案：**“字段一出现就可信”。

### Q3：如果流已经 HTTP 200，最后没有 `analysis_done` 呢？

**推荐回答：** HTTP 200 只说明流开始；模型可能超时、截断或网络断开。客户端必须把 EOF 早于 `analysis_done` 判为失败，保留预览但不显示最终可信状态。服务端在头已发时用 SSE `error` 事件表达生成失败。**追问：取消后能恢复同一结构化对象吗？** 当前没有事件存储和任务恢复，只能新发请求；重放属于后续课程。**错误答案：**“有 partial 就算成功”。

## 9. 复盘与下一课

请回答：1. SSE 事件 JSON 和模型部分 JSON 分别在哪里解析？2. 预览对象与最终对象的 Schema 有何不同？3. 为什么 `analysis_done` 之后仍不能把内容当业务事实？Git 建议提交本课代码、契约和文档，不包含本地密钥。Day 09 才处理 Markdown 与高频渲染性能；本轮不提前实施。
