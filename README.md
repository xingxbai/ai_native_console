# AI Native Console

这是按根目录两份指令逐日建设的个人学习项目。当前完成范围是 **Day 01：仓库体检与最小全栈骨架**；[40 Day 课程总表](docs/training/CURRICULUM.md)和[覆盖矩阵](docs/training/COVERAGE_MATRIX.md)已锁定。旧 L00 课件保留作历史记录。已选定 DeepSeek 作为后续模型供应商，当前没有接入模型、Agent、真实业务数据或审批功能。

## 环境

- 已验证：Node.js 22.17.0、pnpm 7.9.0。
- 工作区：`apps/web` 是 Next.js App Router + React + Tailwind CSS 静态工作台；`apps/api` 是 Fastify + TypeScript API。
- Day 01 无需密钥。`.env.example` 仅记录 API 端口；真实 `.env` 不纳入版本控制。

## 启动

```bash
pnpm install
pnpm dev
```

打开 <http://127.0.0.1:3100> 查看占位 Dashboard，打开 <http://127.0.0.1:3101/health> 应得到 `{"status":"ok"}`。两端也可分别运行 `pnpm --filter @ai-native-console/web dev` 和 `pnpm --filter @ai-native-console/api dev`。默认端口为 3100 和 3101；API 可用 `API_PORT` 覆盖。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

API 测试验证健康端点的正常返回、未知路由 404、错误请求方法 404。课程验收记录见 [Day 01 课件](docs/training/lessons/day-01-repository-bootstrap.md)；逐日进度见 [PROGRESS](docs/training/PROGRESS.md)。Day 02 及以后尚未开始。

## 当前架构

```text
浏览器 -> Next.js 静态工作台
浏览器/命令行 -> Fastify GET /health
```

两个进程目前独立运行。页面不向 API 发起业务请求；模型、工具、数据层会随课程逐步实现。
