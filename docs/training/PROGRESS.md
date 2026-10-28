# 学习进度

更新日期：2026-10-28。**Day 01–06 已完成；Day 07 未开始。** Day 03 曾应用户要求先于 Day 02 实施，Day 02 已随后补齐；后续主题仍按 [40 Day 总表](CURRICULUM.md) 推进。用户已要求移除全部 Mock 模型逻辑，当前问答只使用 DeepSeek。从 Day 04 起不新增或修改 `.test.ts` 单元测试代码。

当前练习主线：主页输入面试题或真实工程情境，DeepSeek 仅提供流式回复。情境题只用于讨论方案，当前没有订单数据、文档检索、业务工具或审批执行。[README](../../README.md)说明现行操作，[面试题库](interview-question-bank.md)区分已实现与待实现。

| Day | 状态 | 证据/下一步 |
| --- | --- | --- |
| 01 仓库体检与最小全栈骨架 | COMPLETED | [Day 01 课件](lessons/day-01-repository-bootstrap.md)：锁文件安装、lint、typecheck、3/3 测试、build；Web/API 200，异常请求 404 |
| 02 开发环境、API 契约与错误边界 | COMPLETED | [Day 02 课件](lessons/day-02-api-contracts.md)：共享 Zod 契约、配置校验、统一错误体与 UUID requestId；25/25 测试、lint/typecheck/build、真实 HTTP 200/400 和页面连接状态 |
| 03 模型服务适配层与密钥安全 | COMPLETED | [Day 03 课件](lessons/day-03-deepseek-provider.md)记录当时的适配与烟测；当前 Mock 已按用户要求删除，仅保留 DeepSeek provider。 |
| 04 第一次非流式 LLM 调用 | COMPLETED | [Day 04 课件](lessons/day-04-first-llm-call.md)：单次问答 API/页面、输入/超时/错误/输出边界；当前 DeepSeek-only 复验见[最小评测样例](../evals/day-04-smoke.md)。旧测试文件删除后保留的 21/21 测试、lint/typecheck/build 通过。 |
| 05 流式协议入门与 SSE 帧解析 | COMPLETED | [Day 05 课件](lessons/day-05-sse-streaming.md)：真实 DeepSeek SSE、同源透传、1–20 字节拆分、慢读、异常 EOF、400；lint/typecheck、现有 21/21 测试、build 通过。 |
| 06 React 流式消费与消息状态管理 | COMPLETED | [Day 06 课件](lessons/day-06-react-stream-state.md)：提问记录、增量终态、近底部跟随；lint/typecheck、已有 21/21 测试、build 通过；浏览器交互待手动验收。 |
| 07 AbortController 与 Node.js 取消传播 | NOT_STARTED | - |
| 08 Partial JSON 与结构化数据渐进解析 | NOT_STARTED | - |
| 09 流式 Markdown 与 React 性能优化 | NOT_STARTED | - |
| 10 Generative UI 安全组件注册表 | NOT_STARTED | - |
| 11 Function/Tool Calling 运行机制 | NOT_STARTED | - |
| 12 Zod 工具契约与描述设计 | NOT_STARTED | - |
| 13 工具注册、服务端执行与权限边界 | NOT_STARTED | - |
| 14 参数校验失败与有界自纠错 | NOT_STARTED | - |
| 15 工具异常、超时、重试与幂等 | NOT_STARTED | - |
| 16 前端 ContextCollector | NOT_STARTED | - |
| 17 Token 预算与上下文裁剪 | NOT_STARTED | - |
| 18 Sliding Window 与 Summary Memory | NOT_STARTED | - |
| 19 Prompt Injection 与数据最小化 | NOT_STARTED | - |
| 20 会话隔离、并发与重复请求 | NOT_STARTED | - |
| 21 StateGraph、Node、Edge 与条件路由 | NOT_STARTED | - |
| 22 把 Tools 接入 LangGraph Agent | NOT_STARTED | - |
| 23 Checkpoint、thread_id 与持久化边界 | NOT_STARTED | - |
| 24 HITL 中断与审批卡片 | NOT_STARTED | - |
| 25 Resume、拒绝审批与安全恢复 | NOT_STARTED | - |
| 26 React Flow 工作流设计器 | NOT_STARTED | - |
| 27 工作流版本化与静态校验 | NOT_STARTED | - |
| 28 Run 状态机与实时执行事件 | NOT_STARTED | - |
| 29 副作用保护与补偿策略 | NOT_STARTED | - |
| 30 超时、重试、取消与恢复演练 | NOT_STARTED | - |
| 31 企业分析工具与数据口径正确性 | NOT_STARTED | - |
| 32 RAG 数据摄取与检索基础 | NOT_STARTED | - |
| 33 混合检索、重排序与引用来源 | NOT_STARTED | - |
| 34 Agent Golden Dataset 与回归评测 | NOT_STARTED | - |
| 35 Tracing、日志、Token 与延迟指标 | NOT_STARTED | - |
| 36 模型降级、限流、缓存与并发预算 | NOT_STARTED | - |
| 37 企业安全、RBAC、租户隔离与审计 | NOT_STARTED | - |
| 38 Docker、环境配置与 CI 检查 | NOT_STARTED | - |
| 39 端到端测试与故障注入 | NOT_STARTED | - |
| 40 最终演示、架构复盘与模拟面试 | NOT_STARTED | - |

## 旧课程记录

- 原 L00 已在前一轮完成，证据位于 [L00 历史课件](lessons/L00-repository-bootstrap.md)。本轮 Day 01 复用代码，重新运行验收并形成独立课件。

## 当前问题

- 本轮整理后最终 `pnpm lint`、`pnpm typecheck`、`pnpm test`（API 15/15、Web 6/6）、`pnpm build` 均 exit 0；首页和 `/health` 返回 200。真实场景题发现默认思考模式会耗尽输出 token 并导致 502，修正为关闭思考模式、1024 token 上限、拒绝截断结果后，面试题和订单审批题均从同源入口返回 200 与正文。细节见 Day 04 课件；未做浏览器自动点击或手机截图。

- 独立 Gemini 原始大纲文件未在仓库找到；现阶段只可对照最终总控中已整合的五部分和明确知识点。详情见 [覆盖矩阵](COVERAGE_MATRIX.md)。
- 课程顺序从 16 课切为 40 Day、Day 03 提前实施和 Day 02 补课的依据及版本敏感 API 风险见 [决策日志](DECISION_LOG.md)。
- 页面手机宽度视觉检查留给学习者手动验收；未宣称自动视觉测试通过。
- 当前只支持 SSE 增量回复；Day 04 的非流式接口已按用户要求删除，历史课件仅保留当时的学习记录。没有会话记忆、浏览器断开后的完整取消传播、断线重放、工具调用或鉴权。API 缺 Key 不启动，且只绑定回环地址；公开部署前必须补鉴权、限流与成本控制。
- Day 05 的浏览器自动点击与手机截图未执行：本机 Work 设置禁用本地浏览器控制。真实 401/429、供应商中途故障和断线重连也未验证；详见 Day 05 课件。
- 用户提供的 DeepSeek Key 曾出现在对话中；已再次提醒轮换，不能把 Git ignore 当作轮换替代。
