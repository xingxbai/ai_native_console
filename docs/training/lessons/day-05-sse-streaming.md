# Day 05：流式协议入门与 SSE 帧解析

日期：2026-10-28。状态：**COMPLETED**。本课只做真实 DeepSeek 文本流、SSE 协议和最小增量展示；Day 06 的消息状态管理、Day 07 的取消传播、Day 08 的 Partial JSON 均未开始。按用户要求，没有新增或修改 `.test.ts` 单元测试，也没有引入模拟模型逻辑。

## 1. 目标、前置与完成定义

前置：Day 04 的单次 DeepSeek 问答、共享 Zod 契约、Next 同源代理和 Fastify API。现在要解决的问题是：模型尚未生成完时，用户能看到已经到达的文本，同时不能把半截文本当成完整答案。

完成后应能：1. 说清 HTTP 响应流、网络 chunk、SSE 事件与模型 token 的区别；2. 从真实 DeepSeek 流得到 `start/delta/done`，并在页面逐步显示；3. 把同一响应按不同大小切开仍还原相同文本；4. 对空输入、非法 JSON、异常 EOF 给出明确失败；5. 解释当前断线和恢复边界。

## 2. 先讲明白概念与数据流

HTTP 请求仍只有一次，响应体按时间逐步到达。`reader.read()` 返回的**网络 chunk 只是任意字节段**：一个 chunk 可以只有半个汉字、半行 `data:`，也可以包含多个事件。SSE 事件由空行结束，可含 `event`、`id`、多行 `data`；以 `:` 开头的行是注释。只有 UTF-8 增量解码、按行与空行组帧之后，才能对完整 `data` 做 `JSON.parse` 和 Zod 校验。Day 08 才讨论**模型生成的部分 JSON**；本课每个 SSE `data` 都是完整 JSON 事件。

```text
浏览器 POST fetch + ReadableStream
  -> Next POST /api/chat/stream（同源透传）
  -> Fastify POST /api/v1/chat/stream
  -> AI SDK streamText() -> DeepSeek
  <- : connected / start / delta... / done 或 error
```

当前使用 `POST fetch`，因为问题在 JSON 请求体中。原生 `EventSource` 使用 GET，不直接承载这个 POST body；它自带重连语义，但本课没有事件存储与重放，不能因出现 `id` 就宣称可恢复。WebSocket 适合双向、持续交互；当前只是一次请求对应单向生成，SSE 足够。页面的“完整回复 / 流式回复”是对照模式，两种模式都请求真实 DeepSeek，每次提交都会产生用量。

## 3. 文件、代码与实施步骤

| 文件 | 作用 |
| --- | --- |
| `packages/contracts/src/index.ts` | 为 `start/delta/done/error` 定义严格 Zod 事件契约 |
| `apps/api/src/model-provider.ts` | 沿用 Day 04 的模型、20 秒、1024 token、关闭思考模式与零重试配置；增加 `streamText().textStream` |
| `apps/api/src/app.ts` | 把真实文本增量编码为 UTF-8 SSE，设置 `text/event-stream`、`no-cache, no-transform`，附 requestId 与递增事件 ID |
| `apps/web/app/api/chat/stream/route.ts` | 校验输入和上游状态/请求 ID，透传上游响应体，不聚合成完整 JSON |
| `apps/web/lib/sse.ts` | `TextDecoder` 增量解码、CRLF/空行/注释组帧，校验事件次序、ID、长度与终态 |
| `apps/web/app/ask-panel.tsx` | 选择完整或流式模式；流式文本逐步显示，收到 `done` 后才标为完成 |

服务端单个事件的形状如下，实际 `id` 的 UUID 和序号每次不同：

```text
id: <requestId>:2
event: delta
data: {"type":"delta","text":"中"}

```

初始 `: connected` 是注释，便于尽早开始响应；它不是周期性心跳，也不证明后续供应商一直可用。流开始后再失败，HTTP 状态已经是 200，所以用终止 `error` 事件表达；客户端必须等 `done`，不能只看 HTTP 200 或连接关闭。

实际运行：`pnpm dev`，打开 <http://127.0.0.1:3100>，切到“流式回复”，选题后提交。与完整回复对比时，同一个问题要提交两次，文本可能不同，不能做逐字相等比较。协议可直接查看：

```bash
curl -N -i -X POST http://127.0.0.1:3100/api/chat/stream \
  -H 'content-type: application/json' \
  --data '{"message":"用中文一句话解释 SSE。"}'
```

`-N` 关闭 curl 的输出缓冲；若只看到最后一次性输出，应先检查响应头、代理缓冲和终端输出环境，不能直接判断服务端没有流。`Cache-Control: no-transform` 与 `X-Accel-Buffering: no` 是减轻代理缓冲的提示，不保证所有中间层遵守。

## 一、没接触过 AI Agent 必须警惕的 5 大深水坑

| 通用深水坑 | 本课关联 | 触发、处理与本课证据 |
| --- | --- | --- |
| 流式 / Partial JSON / Generative UI | 本课重点 | 网络 chunk 可能切断 UTF-8 或 SSE 行；当前只解析完整 SSE 事件、纯文本渲染。1–20 字节切分验证通过；部分业务 JSON 与受控 UI 留给 Day 08–10。 |
| 工具参数与自我纠错 | 暂不展开 | 模型文本可能包含“执行命令”字样；当前没有工具，流中内容只展示，不能触发执行。工具参数校验留给 Day 11–15。 |
| 上下文与 Token | 相关 | 流更早显示文本，但不减少模型总 token 或费用；沿用 500 字输入、1024 输出 token、零重试。没有会话预算。 |
| HITL 与副作用安全 | 相关 | 一半回复不能成为审批结果；当前只显示文本、无写操作，HITL 留给 Day 24–25。 |
| 取消、断流与恢复 | 相关 | 网络 EOF 早于 `done` 会误报成功；客户端明确拒绝异常 EOF。浏览器断开后的模型取消和重连重放尚未实现，分别留给 Day 07/30。 |

## 5. 本课专项五大深水坑

| 失效场景 | 触发、表现和原因 | 处理 | 测试与结果 |
| --- | --- | --- | --- |
| 把网络 chunk 当完整 SSE 帧 | chunk 正好切在 `data:`、JSON 或汉字中，逐块 `JSON.parse` 报错 | `TextDecoder` 流式解码，按空行分帧后解析 | 同一份真实 DeepSeek 响应按 1–20 字节切分，内容均一致；中文正常 |
| 忽略注释、CRLF 和多行 data | 代理/实现使用 `\r\n`，或 `: connected` 被误当 JSON | 忽略注释，兼容 CRLF，`data` 行以换行合并 | 解析器操作验收覆盖 CRLF、注释和 UTF-8 切分，通过 |
| HTTP 200 或 EOF 被当成功 | 流头已发出，模型中途失败或连接提前关闭 | 必须收到有序 `done`；截断和 `error` 拒绝完成态 | 删除真实响应末尾 `done` 后重放，被拒绝；真实供应商中途故障未制造 |
| 上游/代理把流缓冲成完整响应 | Next 先 `response.json()` 或网关缓存/压缩，页面只在最后更新 | Next 透传 `response.body`，禁缓存与变换，`curl -N` 看事件 | 实际同源 curl 收到多个 `delta`；300 B/s 慢读完成 200、3293 B、约 10.75 秒，但未证明所有代理无缓冲 |
| 事件 ID 被误认为可重放 checkpoint | 存在 `id`，却没有事件存储与 `Last-Event-ID` 处理 | ID 只用于本次请求的顺序和关联校验；断线显示失败 | 解析器验证 UUID:序号顺序；没有执行断线重连，Day 30 再做 |

## 6. 测试、验收和限制

2026-10-28 实际执行：

| 命令 / 操作 | 结果 |
| --- | --- |
| `pnpm lint`、`pnpm typecheck`、`pnpm build` | 均 exit 0；Next 构建包含动态 `/api/chat/stream` 路由。首次 typecheck 因生成器闭包未保留校验后的类型而失败，固定 `message` 后重跑通过。 |
| `pnpm test` | exit 0；**已有** API 15/15、Web 6/6，共 21/21；这些测试未覆盖新流式功能。没有编辑 `.test.ts`。 |
| 真实 DeepSeek `curl -N -i POST /api/chat/stream` | HTTP 200，`text/event-stream; charset=utf-8`、`x-request-id`；注释、`start`、多个 `delta`、`done` 顺序到达。 |
| 保存真实流，按每块 1–20 字节重放解析器 | 20 种切分均还原同一正文；32 次 delta，正文 71 字符，请求 ID 与响应头一致。 |
| 真实流字节每 7 字节慢读；删除末尾 `done` 后重放 | 慢读仍完成 32 次更新；截断 EOF 被拒绝，不标完成。 |
| `curl --limit-rate 300` 同源真实流 | HTTP 200，3293 B，约 10.75 秒完成；只验证慢客户端可读，不能据此声称代理背压完整正确。 |
| 同源空白问题、坏 JSON | 分别 HTTP 400，`VALIDATION_ERROR`、`BAD_REQUEST`；响应体带 requestId。 |
| 首页 HTTP GET | 200，HTML 含“完整回复”“流式回复”与选题入口。 |

浏览器自动点击与手机截图**未执行**：本机 Work 设置禁用了本地浏览器控制。真实 401/429、模型中途断流、浏览器关闭后的服务端取消、代理跨环境缓冲、断线重连与事件重放**未验证**。此前命令行直接用 Node 连接本地端口遭执行环境拒绝，随后改为对真实 curl 响应做解析器验收；这不是模型服务故障。已暴露在历史对话中的 DeepSeek Key 仍需在供应商控制台轮换。

可量化验收：

- [x] 两种模式都有真实 DeepSeek 路径；SSE 含 `start/delta/done`、合法请求 ID 和顺序 ID。
- [x] 1–20 字节拆帧、中文 UTF-8、CRLF/注释、慢读和异常 EOF 通过操作验收。
- [x] 空白/坏 JSON 为 400；lint/typecheck、现有 21/21 测试、build 通过。
- [ ] 浏览器交互和手机视觉验收需由学习者按下方步骤完成。

## 7. 常见坑位与排查

| 现象 | 可能原因 | 排查与处理 |
| --- | --- | --- |
| 页面只在最后出现整段文字 | 选的是“完整回复”，或代理/终端缓冲 | 核对模式、Network 响应 `content-type`，用 `curl -N` 看逐个事件。 |
| 出现文字后又变为错误 | 后续 `error`、长度截断或缺 `done` | 这是未完成流，不能把已展示片段当最终答案；看请求 ID 和服务端日志。 |
| 中文显示乱码、`JSON.parse` 报错 | 在字节 chunk 上直接解码/解析 | 使用流式 `TextDecoder`，等空行组成完整事件才解析其 `data`。 |
| 连接关闭但没有最终结果 | 只以 EOF 判断成功 | 检查是否收到 `done`；否则显示中断。 |

## 三、模拟面试真实考场：核心考题与高质量对答

### Q1：网络 chunk、SSE 帧和模型 token 有什么区别？

**推荐口头答案：** HTTP `ReadableStream` 给浏览器的是任意大小的字节 chunk，边界由网络和缓冲决定；一个 SSE 帧由空行分隔，里面可有 `event/id/data`；模型 token 是供应商生成单位。三者没有一一对应关系。我用 `TextDecoder` 增量解码，按空行组帧，再对完整 `data` 做 JSON 与 Zod 解析；同一真实响应按 1–20 字节切分仍得到相同正文。**追问：半个汉字到了怎么办？** 解码器保留未完成的 UTF-8 字节，等后续 chunk 到齐。**常见错误答案：**“一次 `reader.read()` 就是一个模型 token 或完整 JSON”，会在拆帧时失败。**不能夸大：** 本课解析的是完整 SSE 事件，不是 Day 08 的部分业务 JSON。

### Q2：为什么这条链路用 POST fetch + SSE，而不是原生 EventSource 或 WebSocket？

**推荐口头答案：** 当前提问携带 JSON 请求体，经 Next 同源代理到 Fastify；`fetch(POST)` 可以发送 body，并从 `response.body` 读取单向事件流。原生 `EventSource` 主要是 GET、内建重连，但当前没有事件存储，重连也无法恢复既有回复。WebSocket 的双向长连接能力对一次问答没有必要。**追问：SSE 有 `id` 就能断线续传吗？** 不能，还需保存事件并处理 `Last-Event-ID`，本课 ID 仅作本次顺序校验。**常见错误答案：**“EventSource 直接 POST 并自动恢复模型任务”，与当前 API 和持久化能力不符。**不能夸大：** 没有实现断线重连或工作流恢复。

### Q3：流式 HTTP 已经返回 200，模型中途出错怎么办？

**推荐口头答案：** 响应头一旦发送就不能再改成 500。服务端在流内发 `error` 终止事件；客户端只有看到有序 `done` 才把文本标成完整。若 EOF 先到，也显示中断。本课用真实响应删除 `done` 验证异常 EOF 被拒绝；尚未制造真实供应商 401/429 或中途故障。**追问：浏览器关闭后模型一定停止吗？** 当前没有把浏览器断开信号完整传播给模型；Day 07 才做，供应商计费也不能由浏览器关闭来保证。**常见错误答案：**“HTTP 200 就是成功”或“连接关闭就是完成”，都会把半截结果当真。**不能夸大：** 本课没有证明取消、恢复或所有代理行为。

## 9. 面试表达、复盘与下一课

30–60 秒表达：“在个人学习项目中，我把 DeepSeek 的文本生成扩展为 SSE 流。Fastify 发 `start/delta/done/error`，Next 同源透传，前端按 UTF-8 和空行组帧，在 `done` 后才确认完整。我用真实 DeepSeek 响应验证了多次增量、1–20 字节拆分、慢读和异常 EOF，也跑了 lint、类型检查、现有测试和构建。当前没有事件重放或浏览器断开后的模型取消，不把本地演示说成生产运行。”

请自己回答：1. 为什么 `reader.read()` 返回的 chunk 不能直接 `JSON.parse`？2. 为什么流已经 HTTP 200 仍可能失败？3. 如果浏览器关掉，当前哪些层可能继续工作？

小练习：用上面的 `curl -N` 命令观察 `id/event/data` 与空行；再提交 `{"message":"   "}`，解释为什么它是建流前的 HTTP 400。手动验收页面：选“流式回复”，提交一个短问题，确认文字逐步出现、最终状态与请求 ID；再切回“完整回复”观察展示时机。两次模型回答无需逐字一致。手机宽度检查按钮、输入框和正文无重叠。

Git 建议：只提交流协议、页面、契约、课件与进度文档；不要提交 `.env.local`。下一课 Day 06 才建立更完整的 React 消息状态、滚动与渲染策略；本课结束后停止，不自动开始 Day 06。

## 10. 版本参考

本仓库锁定 `ai@7.0.154`、`@ai-sdk/deepseek@3.0.74`、`next@16.4.3`、`fastify@5.12.7`。已读取安装包里的 `ai/dist/index.d.ts` 的 `streamText().textStream/finishReason`、Fastify `docs/Reference/Reply.md` 的 stream 用法和 Next Route Handler 文档。Next 安装包示例仍含旧式 `StreamingTextResponse`；本课按实际版本类型与 Web `Response` API 实现，没有照抄旧 helper。参考 [MDN SSE 格式](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)、[AI SDK 流式文本](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)、[Next Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)。
