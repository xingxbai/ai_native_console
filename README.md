# AI Native Console

面向 AI Agent 工程面试与实际开发情境的个人学习项目。Day 01–06 已完成，Day 07–20 的剩余运行时与视觉验收见课件。首页输入面试题或场景题，由 DeepSeek 回答；只读演示工具可查询本地 JSON 与 JSONPlaceholder 统计数据。模型不读取真实业务系统，Agent 工作流和审批均未实现。

## 运行

需要 Node.js 22、pnpm 7，以及服务端 DeepSeek 密钥。参考 `apps/api/.env.example`，将轮换后的 `DEEPSEEK_API_KEY` 写入被 Git 忽略的 `apps/api/.env.local`。密钥只由 Fastify 进程读取，不放在 Web 环境变量或 `NEXT_PUBLIC_` 中。

```bash
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:3100> 输入问题。DeepSeek 回复逐步显示，收到完成事件才标为完成。页面记录保存在当前浏览器内存中；文本模式会把已完成的部分问答对随下一次请求发送给模型，旧轮次可能触发额外摘要调用。已知格式的邮箱、手机号、JWT 和 `sk-` 密钥在模型输入边界脱敏，但不能视为完整隐私防护。每次模型调用都可能产生费用。API 默认在 <http://127.0.0.1:3101>，`GET /health` 返回 `{"status":"ok"}`；页面右上角的状态只表示基础 API 可达，不保证 DeepSeek 可用。

## 练习主线

| 内容 | 当前可做 | 证据边界 |
| --- | --- | --- |
| 面试题 | 输入 Agent/Workflow、Tool Calling、取消与超时等题目提问 | 回复是模型生成的参考材料，需对照[题库](docs/training/interview-question-bank.md)和实际代码核查 |
| 真实场景 | 用演示订单、员工考勤和任务统计做只读工具问答；讨论审批与文档检索设计 | 数据均为演示；当前没有真实订单系统、文档检索或审批执行 |
| 工程演示 | 展示输入校验、统一错误、requestId、超时和 DeepSeek 调用 | 已有代码与实际 HTTP 记录；不声称生产部署或业务指标 |

练习时先自己回答，再用页面提问，最后核对[课程进度](docs/training/PROGRESS.md)和对应课件的实现边界。完整 40 Day 路线在[课程总表](docs/training/CURRICULUM.md)，逐项映射在[覆盖矩阵](docs/training/COVERAGE_MATRIX.md)。

## 架构与接口

```text
浏览器练习表单 -> Next.js POST /api/chat/stream -> Fastify POST /api/v1/chat/stream -> DeepSeek
                         共享 Zod 契约                  服务端密钥、20 秒上限
浏览器首页 -> Next.js 服务端 -> Fastify GET /health
```

Web 使用 Next.js App Router、React、TypeScript、Tailwind CSS；API 使用 Node.js、TypeScript、Fastify；`packages/contracts` 提供共享 Zod 契约。`POST /api/v1/chat/stream` 接受最多 500 字的 `message`，返回带 `start/delta/done/error` 的 SSE；Next 同源 `/api/chat/stream` 透传，页面按事件递增展示。当前关闭 DeepSeek 思考模式，模型输出上限为 1024 token，禁用 SDK 自动重试；达到上限的截断答复会被拒绝。流式 `id` 只表示本次请求的事件顺序，尚不支持断线重放。当前仅适合可信本地环境：没有登录、限流、成本总预算或跨用户隔离。

选择“结构化分析”时，同一接口增加 `format=analysis`，用 `partial` 事件在摘要、风险和下一步的三列表格中预览；最终对象通过 Schema 后才发送 `analysis_done`。学习者已提供真实渐进事件和原页面完成截图；新增表格仍待浏览器验收，见 [Day 08 课件](docs/training/lessons/day-08-partial-json.md)。

文本问答使用安全的 GFM Markdown 展示列表、代码块和表格；未闭合代码围栏生成中先按原文展示。渲染与每帧合并的验收边界见 [Day 09 课件](docs/training/lessons/day-09-markdown-performance.md)。

选择“可视化”时，DeepSeek 返回一个经校验的 `kpi/table/bar` 数据对象。页面先显示固定高度占位，收到 `visual_done` 后才展示 KPI、表格或 ECharts 柱状图。模型不能提供图表配置或 HTML；当前没有业务数据源，问题中的数字仅作示例。真实模型和浏览器视觉待验，见 [Day 10 课件](docs/training/lessons/day-10-generative-ui.md)。

选择“工具问答”后，问“请查询示例任务统计系统的用户1：总任务数、已完成数和未完成数分别是多少？”模型可调用 `getDemoTaskStats`；Node 服务端请求 JSONPlaceholder 的用户 1 任务 API，校验后计算汇总，浏览器只收最终回答的文本流。数据是公开示例，不是真实业务指标。真实 DeepSeek 与外部 HTTP 路径已验，完整浏览器展示待验，见 [Day 11 课件](docs/training/lessons/day-11-tool-calling.md)。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
```

按用户要求，不新增或改写 `.test.ts` 单元测试，也不在后续操作中运行 build 或启动项目。已有测试覆盖配置、健康端点、错误契约和 API 状态降级；它们不覆盖新问答交互。非流式的历史验收见[Day 04 课件](docs/training/lessons/day-04-first-llm-call.md)；该接口现已删除。流式协议在[Day 05 课件](docs/training/lessons/day-05-sse-streaming.md)，页面提问记录与滚动验收在[Day 06 课件](docs/training/lessons/day-06-react-stream-state.md)。当前接口示例：

```bash
curl -N -i -X POST http://127.0.0.1:3100/api/chat/stream \
  -H 'content-type: application/json' \
  --data '{"message":"Agent 与 Workflow 的适用边界是什么？"}'
```

Day 07 已加入“停止”按钮和逐层取消信号；浏览器断开后模型是否及时停止仍待运行时验收，不能保证已产生的费用退回。断线重放留待 Day 30。

流式问答遇到停止、弱网、断网或关闭浏览器时的分层行为，见 [SSE 流式请求生命周期与取消速查](docs/training/SSE-STREAM-LIFECYCLE.md)。

服务端地址可由 `apps/web/.env.local` 的 `API_INTERNAL_URL` 覆盖；API 主机/端口可由 `apps/api/.env.local` 的 `API_HOST`、`API_PORT` 覆盖，API 仅允许回环地址。用户曾在对话中公开过一枚 DeepSeek Key，应在供应商控制台撤销并轮换；Git ignore 不能代替轮换。
