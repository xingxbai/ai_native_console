# AI Native Console

这是按根目录两份指令逐日建设的个人学习项目。**Day 01–03 已完成**；Day 03 曾应用户要求先做，Day 02 随后补齐。[40 Day 课程总表](docs/training/CURRICULUM.md)和[覆盖矩阵](docs/training/COVERAGE_MATRIX.md)记录顺序与覆盖。服务端已接入 DeepSeek 适配器，网页现在会检查 API 健康状态；尚无聊天接口、Agent、真实业务数据或审批功能。

## 环境

- 已验证：Node.js 22.17.0、pnpm 7.9.0。
- 工作区：`apps/web` 是 Next.js App Router + React + Tailwind CSS 工作台；`apps/api` 是 Fastify + TypeScript API；`packages/contracts` 提供 Web/API 共用的 Zod 契约。
- Web/API 启动与 Mock 测试无需密钥。根 `.env.example` 汇总配置；API 从 `apps/api/.env.local` 读取可选的 `API_HOST`、`API_PORT`，默认 `127.0.0.1:3101`。Next 服务端可用 `apps/web/.env.local` 的 `API_INTERNAL_URL` 覆盖 API 地址，默认 `http://127.0.0.1:3101`。真实密钥只放 Git 忽略的 `apps/api/.env.local`，不要放入 `NEXT_PUBLIC_` 变量。

## 启动

```bash
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:3100> 查看 Dashboard 的 API 连接状态，打开 <http://127.0.0.1:3101/health> 应得到 `{"status":"ok"}` 和 `x-request-id` 响应头。两端也可分别运行 `pnpm --filter @ai-native-console/web dev` 和 `pnpm --filter @ai-native-console/api dev`；首次单独启动前先运行 `pnpm prepare:contracts`。Web 默认端口 3100，API 默认端口 3101。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

测试覆盖 API 配置、健康端点、统一 400/404/500 错误与请求 ID、Web 对无效响应和断网的降级，以及 Mock/DeepSeek 适配器的配置边界。Day 02 验收记录见 [课件](docs/training/lessons/day-02-api-contracts.md)；逐日状态见 [PROGRESS](docs/training/PROGRESS.md)。Day 04 及以后尚未开始。

## API 契约

`GET /health` 的成功体为 `{"status":"ok"}`。API 生成每次请求的 UUID，放在 `x-request-id`；失败体统一为 `{"error":{"code":"VALIDATION_ERROR","message":"...","requestId":"..."}}`，其中 `requestId` 与响应头相同。`GET /health?unexpected=1` 返回 400，未知路径返回 404；内部异常返回固定的 500 文案。Next 服务端会验证成功体与请求 ID，API 不可用时 Dashboard 显示“暂不可用”。

## DeepSeek 服务端适配

Day 03 已实现确定性 Mock 与 DeepSeek provider。只在需要验证真实连通性时运行以下命令，它会产生一次模型 API 用量：

```bash
pnpm --filter @ai-native-console/api smoke:deepseek
```

命令从 `apps/api/.env.local` 读取 `DEEPSEEK_API_KEY` 和可选的 `DEEPSEEK_MODEL`，默认使用 `deepseek-v4-flash`；只输出状态、模型和简短回复。完整验收与限制见 [Day 03 课件](docs/training/lessons/day-03-deepseek-provider.md)。Day 04 的用户聊天调用尚未实现。

## 当前架构

```text
浏览器 -> Next.js 工作台 -> Fastify GET /health
                 共享 Zod 契约 <- Fastify 健康与错误响应
仅服务端 smoke -> ModelProvider -> Mock 或 AI SDK DeepSeek -> DeepSeek API
```

两个进程目前独立运行。页面只通过 Next 服务端检查 API 健康状态，不向 API 发起模型或业务请求；工具、数据层及用户聊天流程仍待后续课程。
