# AI Native Console

面向 AI Agent 工程面试与实际开发情境的个人学习项目。当前完成 Day 01–05：首页可选面试题或场景题，选择“完整回复”或“流式回复”后由 DeepSeek 回答。模型不读取仓库或业务数据；工具调用、Agent 工作流和审批均未实现。

## 运行

需要 Node.js 22、pnpm 7，以及服务端 DeepSeek 密钥。参考 `apps/api/.env.example`，将轮换后的 `DEEPSEEK_API_KEY` 写入被 Git 忽略的 `apps/api/.env.local`。密钥只由 Fastify 进程读取，不放在 Web 环境变量或 `NEXT_PUBLIC_` 中。

```bash
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:3100>，选一道题或直接提问。“完整回复”在生成完后显示，“流式回复”逐步显示，收到完成事件才标为完成。每次提交都会产生真实模型用量。API 默认在 <http://127.0.0.1:3101>，`GET /health` 返回 `{"status":"ok"}`；页面右上角的状态只表示基础 API 可达，不保证 DeepSeek 可用。

## 练习主线

| 内容 | 当前可做 | 证据边界 |
| --- | --- | --- |
| 面试题 | 从 Agent/Workflow、Tool Calling、取消与超时等题目开始提问 | 回复是模型生成的参考材料，需对照[题库](docs/training/interview-question-bank.md)和实际代码核查 |
| 真实场景 | 讨论订单状态审批、客服文档检索、模型故障处理方案 | 这些是设计情境；当前没有订单、文档检索、工具或审批执行 |
| 工程演示 | 展示输入校验、统一错误、requestId、超时和 DeepSeek 调用 | 已有代码与实际 HTTP 记录；不声称生产部署或业务指标 |

练习时先自己回答，再用页面提问，最后核对[课程进度](docs/training/PROGRESS.md)和对应课件的实现边界。完整 40 Day 路线在[课程总表](docs/training/CURRICULUM.md)，逐项映射在[覆盖矩阵](docs/training/COVERAGE_MATRIX.md)。

## 架构与接口

```text
浏览器练习表单 -> Next.js POST /api/chat[/stream] -> Fastify POST /api/v1/chat[/stream] -> DeepSeek
                         共享 Zod 契约                  服务端密钥、20 秒上限
浏览器首页 -> Next.js 服务端 -> Fastify GET /health
```

Web 使用 Next.js App Router、React、TypeScript、Tailwind CSS；API 使用 Node.js、TypeScript、Fastify；`packages/contracts` 提供共享 Zod 契约。`POST /api/v1/chat` 接受最多 500 字的 `message`，返回完整 `assistant` 文本、`provider=deepseek`、模型名和请求 ID。`POST /api/v1/chat/stream` 接受同一输入，返回带 `start/delta/done/error` 的 SSE；Next 同源 `/api/chat/stream` 透传，页面按事件递增展示。当前关闭 DeepSeek 思考模式，模型输出上限为 1024 token，禁用 SDK 自动重试；达到上限的截断答复会被拒绝。流式 `id` 只表示本次请求的事件顺序，尚不支持断线重放。当前仅适合可信本地环境：没有登录、限流、成本总预算或跨用户隔离。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

按用户要求，不新增或改写 `.test.ts` 单元测试。已有测试覆盖配置、健康端点、错误契约和 API 状态降级；它们不覆盖新问答交互。非流式验收在[Day 04 课件](docs/training/lessons/day-04-first-llm-call.md)，流式协议和拆帧验收在[Day 05 课件](docs/training/lessons/day-05-sse-streaming.md)。可直接使用页面，或执行：

```bash
curl -i -X POST http://127.0.0.1:3100/api/chat \
  -H 'content-type: application/json' \
  --data '{"message":"Agent 与 Workflow 的适用边界是什么？"}'
```

流式协议用 `curl -N -i -X POST http://127.0.0.1:3100/api/chat/stream -H 'content-type: application/json' --data '{"message":"用中文一句话解释 SSE。"}'` 查看。浏览器关闭后的模型取消、断线重放、Partial JSON 和 Generative UI 分别在后续 Day 07、30、08、10 处理。

服务端地址可由 `apps/web/.env.local` 的 `API_INTERNAL_URL` 覆盖；API 主机/端口可由 `apps/api/.env.local` 的 `API_HOST`、`API_PORT` 覆盖，API 仅允许回环地址。用户曾在对话中公开过一枚 DeepSeek Key，应在供应商控制台撤销并轮换；Git ignore 不能代替轮换。
