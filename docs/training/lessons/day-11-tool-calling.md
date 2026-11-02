# Day 11：Function / Tool Calling 运行机制

日期：2026-10-30。状态：**IN_PROGRESS**。使用真实 DeepSeek 和公网 JSONPlaceholder 演示任务数据，无本地 Mock。只推进本课；页面与断连待手动验收。

## 1. 目标与真实场景

选“工具问答”，输入：`请查询示例任务统计系统的用户1：总任务数、已完成数和未完成数分别是多少？` 模型提出调用 `getDemoTaskStats`；Node 服务端请求公开的 `https://jsonplaceholder.typicode.com/todos?userId=1`，计算汇总；模型再根据工具结果回答。**数据只是公网示例，绝不代表真实业务指标。**

本节要分清：模型提出调用、应用执行外部 HTTP、模型使用结果。普通概念问题可直接回答。当前工具固定查询用户 1，参数化与权限放在后续课程。

## 2. 主流程和重点代码

`问题 → DeepSeek 选择工具 → Node fetch 外部 API → 校验并汇总 → 工具结果回 DeepSeek → 最终文本 SSE`。用户界面只显示回答，内部工具事件留在服务端。

**服务端读取和计算**，见 `apps/api/src/demo-stats.ts`：

```ts
// 公网演示接口只读；Node 端完成统计，只把汇总数字交给模型。
const response = await fetch("https://jsonplaceholder.typicode.com/todos?userId=1", { signal });
if (!response.ok) throw new Error(`Demo statistics API returned ${response.status}`);
const tasks = tasksSchema.parse(await response.json());
const completed = tasks.filter((task) => task.completed).length;
return { total: tasks.length, completed, pending: tasks.length - completed };
```

**模型只看到工具定义**，见 `apps/api/src/model-provider.ts`：

```ts
getDemoTaskStats: tool({
  description: "Fetch the public JSONPlaceholder demo API with userId=1 fixed in the URL. Return only that user's total, completed, and pending task counts. Use for questions about demo user 1 task statistics. These are sample data, not real business metrics.",
  inputSchema: z.strictObject({}),
  // 模型只提出调用；Node 服务端实际请求公网示例接口。
  execute: async () => getDemoTaskStats(abortSignal),
}),
```

SDK 最多运行两步：第一步可调用工具，第二步禁用工具并回答。`apps/api/src/app.ts` 只把回答文本转为 `delta`，最后发 `done`；前端不接收原始工具结果。普通概念题则第一步直接回答。

## 3. 通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | **相关**：外部 JSON 完整校验后才参与统计；前端只收文本 SSE。 |
| 工具参数与自我纠错 | **本课重点**：无参数工具用 `z.strictObject({})`；参数校验与有界纠错留 Day 12–14。 |
| 上下文与 Token | **相关**：只把三个汇总数字交给模型，不传任务标题和整份列表。 |
| HITL 与副作用安全 | **相关**：公网示例接口只读；本课没有业务写入或审批。 |
| 取消、断流与恢复 | **相关**：abort signal 传给模型和外部 fetch；缺 `done` 不能算完成，断线恢复未实现。 |

## 4. 本课专项五大深水坑

| 触发与表现 | 原因、处理和测试 |
| --- | --- |
| 公网接口 DNS/连接超时 | 外部依赖不稳定；真实演练中 DummyJSON 的 Node 连接多次超时，改用 JSONPlaceholder。工具失败应走错误终态，不得编造数字。 |
| HTTP 200 但字段错误 | 网络响应不是 TypeScript 类型；`tasksSchema` 校验 `userId=1` 与 `completed:boolean`。非法字段验收待做。 |
| 模型误解统计范围 | 曾把固定 `userId=1` 说成“整体样本”；工具描述明确查询参数后，真实复测正确称为“用户1”。 |
| 数字吻合但未真正请求接口 | 模型可能猜中；本轮在不替换真实 fetch 的前提下计数，确认工具执行期间对 JSONPlaceholder 发出 1 次请求。 |
| 多次调用或泄露原始任务列表 | 会增加延迟和上下文；本课最多两步，第二步禁工具，工具结果仅三个汇总字段。 |

## 5. 实际测试和手动验收

实际联网：JSONPlaceholder 用户 1 有总任务 **20**、已完成 **11**、未完成 **9**。真实 DeepSeek 在工具问答中返回同样三个数字，并注明“公开示例样本”；出站计数为 **1 次**。曾先试 DummyJSON：第一次取到购物车数据，后续 Node 连接超时；改用 JSONPlaceholder 后完成复测。外部服务未来可能更新，以当次响应为准。

最终运行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test` 和 `git diff --check`，均 exit 0；现有 API 15/15、Web 6/6 测试通过，但不覆盖新增外部工具链。按用户要求，不新增/修改 `.test.ts`，不启动项目，不运行 build；**浏览器页面、断连和非法字段路径未验**。

手动验收：

1. 在“工具问答”输入本节示例问题，页面应流式显示 20/11/9 和示例数据说明。Network 只见 `start/delta/done`，不会出现内部工具 JSON。
2. 打开上述公开 URL，核对 `completed` 布尔值的数量；若公网数据变化，以当次响应为准。
3. 问“什么是 Tool Calling？”应直接回答；页面不显示内部调用，是否误调用需要服务端 trace 验证，本节未建 trace 面板。
4. 停止生成或断网后不得显示“已完成”；外部 HTTP 取消传播待实际运行验收。

## 6. 模拟面试

**Q1：模型说要查统计接口，接口就已经被请求了吗？**
回答：没有。模型只生成工具调用提议；Node 上注册的 `execute` 才执行 `fetch`，外部数据校验和统计后返回模型。追问：如何证明执行？看服务端出站请求或 trace，本轮真实计数为 1。错误答案：“LLM 自己运行了 HTTP 请求。”

**Q2：外部 API 有 JSON，为什么还要 Schema？**
回答：HTTP 200 不保证数组元素符合预期。运行时校验保证只统计用户 1 且 `completed` 是布尔值，否则拒绝本次工具结果。追问：TypeScript 类型够吗？不够，它不会验证网络字节。错误答案：“接口文档写了字段就可信。”

**Q3：为什么工具结果不直接发给前端？**
回答：用户需要的是汇总结论，原始任务列表是无关数据。Node 先做统计，仅把三个数字送给模型，浏览器只接收最终文本。追问：如何排查？服务端脱敏 trace，按 requestId 关联，不靠前端显示内部 JSON。错误答案：“为了调试把所有工具结果推给浏览器。”

## 7. 复盘与下一课

### 工具失败时的调试记录

新增的 `getDemoUserInfo` 曾在 ESM 模块中使用 `__dirname`，直接调用复现 `ReferenceError: __dirname is not defined`。页面先看到模型生成的 “I'll fetch...” 随后失败，是因为工具执行抛错，API 将其归为通用 `MODEL_UNAVAILABLE`。此前 API 日志只记录 `errorName`，终端看不到具体错误；现在开发环境的 Fastify `error` 日志包含异常堆栈，生产环境仍只记录错误类型。`getDemoUserInfo` 改用 `import.meta.url` 定位 JSON 文件。实际无服务调用成功读取顶层 `userInfo` 字段；`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）及 `git diff --check` 均 exit 0。本轮没有启动项目、运行 build 或通过浏览器复验完整问答。

### 大 JSON 直接流式返回

输入**完全等于**“返回用户信息”时，`direct-tools.ts` 注册表匹配本地工具，API 从 `userInfo.json` 分块读取并发送 `start/delta/done`，不调用 DeepSeek；页面按原始 JSON 文本显示。新增确定性命令只需在注册表登记匹配规则、名称和流处理函数，通用 SSE 路由不增加逐项判断。原有 AI SDK `getDemoUserInfo` 工具仍供其他用户信息问题使用；它需要模型继续处理结果，不适合原样传输大文件。关键路径为 `direct-tools.ts` 的工具登记、`app.ts` 的通用转发、`demo-stats.ts` 的文件流、`sse.ts` 的本地流上限和 `ask-panel.tsx` 的原文展示。文件可能包含敏感信息，真实业务接入前必须在服务端加入身份和字段权限控制。

本轮无服务 SSE 检查：HTTP 200、`provider=local`、92 个 `delta`、751,554 字节，重组后与磁盘文件逐字一致，末尾为 `done`。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）和 `git diff --check` 均 exit 0；没有启动项目、运行 build 或做浏览器验收。手动验证时，在任意回答模式输入该固定指令，Network 中确认 `start` 标明 `local`，页面持续显示原始 JSON，并与文件首尾字段核对。

### 六个订单场景练习

`apps/api/src/data/demo-orders.json` 是固定日期 **2026-10-30** 的演示数据，模拟后端订单 API 的返回；它不代表真实业务和系统当前日期。页面“订单场景示例”下拉框可依次填入六个问题。前五个在 `direct-tools.ts` 中匹配并由 Node 读取、计算或排序；第六个由 DeepSeek 调用 `getRefundComparison`，`order-demo.ts` 计算后只向模型返回小型汇总。通用 SSE 路由不识别具体退款问题。

| 输入 | 预期观察 | 数据走向 |
| --- | --- | --- |
| 返回订单 123 的完整数据 | 原始 JSON，状态“已退款”、金额 899 | JSON 文件 → Node → SSE |
| 订单 123 现在是什么状态？ | “已退款” | JSON 文件 → Node 提取字段 → SSE |
| 统计今天有多少笔退款 | 演示日期 2026-10-30 有 2 笔 | JSON 文件 → Node 计数 → SSE |
| 列出退款金额最高的 10 笔订单 | Markdown 表格，首位订单 123、退款 899 元 | JSON 文件 → Node 排序 → SSE |
| 把这份 JSON 转成表格 | 12 行演示订单的 Markdown 表格 | JSON 文件 → Node 表格化 → SSE |
| 这周退款为什么变多了？ | 模型解释本周 6 笔、上周 3 笔；不应把原因分布说成已证实的增长原因 | JSON 文件 → Node 汇总 → DeepSeek → SSE |

重点代码：`direct-tools.ts` 的 `DirectTool` 登记确定性查询；`order-demo.ts` 负责读取校验和退款统计；`model-provider.ts` 注册 `getRefundComparison`，由模型决定是否调用，再基于工具汇总回答；`app.ts` 只处理通用流转；`ask-panel.tsx` 用 SSE `start.display` 决定展示 JSON 原文还是 Markdown。这里的“今天”和“这周”是演示数据中的固定时间窗口；真实项目应由请求日期、时区和后端统计口径共同决定。任意 JSON 上传和通用 JSON 转表格尚未实现，第五条只转换这份演示订单 JSON。

此前无服务 SSE 检查逐一验证前五条为 HTTP 200、`provider=local`、`done`，核对了返回内容；第六条业务模块汇总为本周 6 笔、上周 3 笔。工具层调整后的静态检查和现有测试结果以最新执行记录为准；**尚未实际调用 DeepSeek**。没有启动项目、运行 build 或做浏览器验收；页面下拉框、表格渲染及真实模型回复需手动复验。

复盘：1. 模型、Node、JSONPlaceholder 各负责什么？2. 为什么“数字吻合”还需要出站请求证据？3. 换成真实统计系统后，身份、租户和统计口径该在哪层检查？

Git 建议只提交本课服务端工具、协议精简、课件和进度，不提交密钥。Day 12 再展开工具参数契约，本轮停在 Day 11。
