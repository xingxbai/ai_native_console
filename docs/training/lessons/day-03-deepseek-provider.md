# Day 03：DeepSeek 模型服务适配层与密钥安全

状态：**COMPLETED**。Day 03 当时先于 Day 02 实施；Day 02 后来已补齐。用户随后要求只用 DeepSeek，当前代码没有模拟模型分支或独立 smoke 脚本。下面先讲当前可运行路径，末尾保留当时实际测试摘要。

## 1. 目标、前置与使用场景

目标是让面试题/场景问答只通过服务端调用 DeepSeek，并能解释密钥、模型配置、超时和调用边界。前置是 Day 01 的 Node/Fastify 骨架；现行应用也依赖 Day 02 的共享 API 契约。真实场景：用户在 Web 输入“Agent 与 Workflow 如何取舍”，Next 代理到 Fastify，由 Fastify 使用本地密钥请求 DeepSeek。当前没有多供应商降级、业务数据读取或 Agent Loop。

## 2. 核心概念与链路

`ModelProvider` 是 Fastify 与供应商 SDK 之间的窄接口：`generateReply(instructions, prompt)`。现在只有一个 DeepSeek 实现。接口的价值是让 HTTP 层只处理请求契约与错误映射，供应商调用集中处理模型 ID、输入、deadline、输出预算；它并不意味着已经有多个可切换模型。

```text
浏览器 -> Next 同源代理 -> Fastify -> createDeepSeekProvider -> AI SDK -> DeepSeek
                                           ^
                                   服务端 .env.local
```

Fastify 启动时校验 `DEEPSEEK_API_KEY` 与允许的模型 ID，缺 Key 直接失败。密钥只存于被 Git 忽略的 `apps/api/.env.local`，不进入浏览器、请求体、响应或普通日志。`/health` 只检查基础 API 路由，不访问模型。

## 3. 代码与可运行操作

| 文件 | 当前作用 |
| --- | --- |
| `apps/api/src/config.ts`、`index.ts` | 读取服务端环境、校验 Key/模型，限制本地监听地址 |
| `apps/api/src/model-provider.ts` | 使用 `@ai-sdk/deepseek`、`generateText`；关闭默认思考模式，20 秒上限、1024 输出 token、零自动重试；拒绝达到长度上限的不完整答复 |
| `apps/api/src/app.ts` | 将模型文本封装成 assistant 回复，映射超时/供应商失败/无效输出 |
| `apps/api/.env.example` | 只列变量名与示例，不含真实 Key |

在忽略文件 `apps/api/.env.local` 配置轮换后的 Key，运行 `pnpm dev`，然后从页面提问或执行：

```bash
curl -i -X POST http://127.0.0.1:3100/api/chat \
  -H 'content-type: application/json' \
  --data '{"message":"Reply with exactly OK."}'
```

当前允许 `deepseek-v4-flash` 和 `deepseek-v4-pro`；默认 `deepseek-v4-flash`。实际支持情况应以供应商和锁定 SDK 版本为准，升级前重新核对。用户曾在对话中暴露 Key，须在 DeepSeek 控制台撤销并轮换；文件权限或 Git ignore 不能修复已泄露凭据。

## 一、通用五大深水坑

| 深水坑 | 本课关联 | 触发、处理与验证边界 |
| --- | --- | --- |
| 流式 / Partial JSON / Generative UI | 暂不展开 | 本课只接完整文本；不能把未来的部分输出当最终对象，Day 05–10 再测。 |
| 工具参数与自我纠错 | 相关 | 模型输出不能成为工具执行授权；本课没有工具，Day 11–15 才实现校验与有界纠错。 |
| 上下文与 Token | 相关 | 输入限 500 字、输出限 1024 token、零自动重试；无会话记忆和总预算。 |
| HITL 与副作用安全 | 暂不展开 | 只有文本生成；场景题涉及审批时只能讨论设计，不能修改业务记录。 |
| 取消、断流与恢复 | 相关 | 模型有 20 秒 deadline；浏览器断开后的信号传播与恢复未实现。 |

## 5. 本课专项五大深水坑

| 失效场景 | 触发与原因 | 防护与测试 |
| --- | --- | --- |
| Key 泄露到前端或仓库 | 写进 `NEXT_PUBLIC_`、源文件或可提交配置 | 仅服务端 `.env.local`；`git check-ignore` 与文件权限已检查。已在对话中出现的 Key 仍需轮换。 |
| 缺 Key 时静默启动 | API 监听后每次提问才失败，难定位 | 启动前校验，缺 Key 退出；当前无 Key 启动拒绝路径已在此前验收。 |
| 使用失效模型 ID | 复制旧别名导致远端 404/400 | 模型 ID 白名单；当时核对 SDK 文档，真实 `deepseek-v4-flash` 请求成功。供应商变更需复核。 |
| 短答成功误当模型质量证明 | `OK` 成功但复杂业务题仍可能编造 | 只记录单次连通与样本，不推断准确率或可用性 SLA；Day 34 才做 Golden Dataset。 |
| 无界等待/重试与错误泄露 | 外部服务挂起、反复计费、异常含内部信息 | 20 秒 deadline、1024 token、零重试；达到长度上限返回 502，Fastify 统一 503/504/502。 |

## 6. 测试、验收与证据

当前代码整理后的实际执行（2026-10-27）：`pnpm lint`、`pnpm typecheck`、`pnpm build` 均 exit 0；`pnpm test` 为现有 **21/21**，不覆盖真实模型语义。首页与 `/health` HTTP 200；从 Next 同源 `/api/chat` 发真实 DeepSeek 请求，返回 200、`provider=deepseek`、模型 `deepseek-v4-flash`、文本 `OK`。这只证明本次本地连通。

历史 Day 03 实施时：安装 `ai@7.0.154`、`@ai-sdk/deepseek@3.0.74`、`zod@4.6.7`；当时 8/8 测试、lint/typecheck/build 通过。独立 smoke 命令先被执行环境的本地 IPC 权限阻止，获准后真实模型返回 `OK`，单次耗时 895ms。后来用户要求删除模拟分支，相关测试文件与独立 smoke 脚本均已删除。**8/8 和 895ms 是历史观察，不是当前测试数或平均性能。**

验收清单：

- [x] 服务端 Key 与模型配置通过启动校验；当前只有 DeepSeek 路径。
- [x] 实际同源 HTTP 返回 DeepSeek `assistant` 文本；保留超时与错误边界。
- [x] 当前 lint/typecheck、21/21 现有测试、build 通过。
- [ ] 已暴露 Key 的轮换由密钥持有人在 DeepSeek 控制台完成；真实 401/429/自然超时未测。

手动验收：运行 `pnpm dev`，在页面提交短题，核对回复来源与请求 ID；访问 `/health` 并区分其基础 API 意义。临时移除本地 Key 后启动 API，应只看到配置错误字段名而不出现 Key 内容；恢复轮换后的 Key 再重启。不要把真实 Key 粘到终端命令或文档。

## 三、模拟面试真实考场

### Q1：只有 DeepSeek 时还需要 provider 边界吗？

**推荐口头答案：** 需要一个很窄的边界把 SDK、模型 ID、超时和输出上限留在服务端。Fastify 路由只负责校验请求、调用和错误映射；当前接口只有 DeepSeek 一种实现，没有多供应商降级。**追问：这是否已经解决供应商切换？**没有，切换时仍需检验协议、模型能力、错误码和评测结果。**常见错误：**“定义接口就自动支持多模型”，接口形状不保证语义兼容。

### Q2：为什么 Key 只放服务端？

**推荐口头答案：** 前端包和 `NEXT_PUBLIC_` 变量对访问者可见。当前 Fastify 从 Git 忽略的 `.env.local` 读取 Key，启动时校验，响应不返回它；这降低本地误提交风险，但不是企业密钥托管。**追问：Key 已出现在对话里怎么办？**去供应商控制台撤销并轮换，再更新本地文件。**常见错误：**“Git ignore 了就安全”，它无法撤销已经暴露的凭据。

### Q3：怎样证明模型真的可用？

**推荐口头答案：** 我从用户实际走的 Next 同源入口发短题，检查 200、`provider=deepseek`、assistant 文本和请求 ID；本轮得到 `OK`。同时检查缺 Key 启动失败和接口错误边界。单次成功只证明当时链路可用，不证明复杂回答质量、持续稳定或生产 SLA。**追问：`/health` 200 够吗？**不够，它不调用 DeepSeek。**常见错误：**把一次 895ms 历史观测当平均延迟。

## 9. 复盘与下一课依赖

请自己回答：1. provider 接口和多供应商能力之间差了哪些验证？2. 为什么 `.env.local` 权限为 600 仍必须轮换已暴露的 Key？3. 真实短答 `OK` 能证明什么，不能证明什么？

这是一项个人学习项目，面试时应如实说明没有生产部署或业务效果指标。Day 04 在此基础上加入完整用户问答链路；当前已完成 Day 04，本轮维护不进入 Day 05。建议仅提交源码、示例配置与文档。
