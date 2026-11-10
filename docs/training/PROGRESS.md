# 学习进度

更新日期：2026-11-09。**Day 01–06、Day 21–25 与 Day 31 已完成；Day 07–20、26–27、32–34 进行中；Day 28–30 应用户要求延期。** 部分运行时与视觉验收待完成。Day 03 曾先于 Day 02 实施，后者已补齐。当前模型问答只使用 DeepSeek；从 Day 04 起不新增或修改 `.test.ts` 单元测试代码。

当前练习主线：主页输入面试题或真实工程情境，DeepSeek 提供流式回复；Day 11 增加只读的公网演示统计 API 工具，以及六个基于本地演示订单 JSON 的查询、计算、表格和模型解释场景。没有真实订单系统、文档检索或审批执行。[README](../../README.md)说明现行操作，[面试题库](interview-question-bank.md)区分已实现与待实现。

| Day | 状态 | 证据/下一步 |
| --- | --- | --- |
| 01 仓库体检与最小全栈骨架 | COMPLETED | [Day 01 课件](lessons/day-01-repository-bootstrap.md)：锁文件安装、lint、typecheck、3/3 测试、build；Web/API 200，异常请求 404 |
| 02 开发环境、API 契约与错误边界 | COMPLETED | [Day 02 课件](lessons/day-02-api-contracts.md)：共享 Zod 契约、配置校验、统一错误体与 UUID requestId；25/25 测试、lint/typecheck/build、真实 HTTP 200/400 和页面连接状态 |
| 03 模型服务适配层与密钥安全 | COMPLETED | [Day 03 课件](lessons/day-03-deepseek-provider.md)记录当时的适配与烟测；当前 Mock 已按用户要求删除，仅保留 DeepSeek provider。 |
| 04 第一次非流式 LLM 调用 | COMPLETED | [Day 04 课件](lessons/day-04-first-llm-call.md)：单次问答 API/页面、输入/超时/错误/输出边界；当前 DeepSeek-only 复验见[最小评测样例](../evals/day-04-smoke.md)。旧测试文件删除后保留的 21/21 测试、lint/typecheck/build 通过。 |
| 05 流式协议入门与 SSE 帧解析 | COMPLETED | [Day 05 课件](lessons/day-05-sse-streaming.md)：真实 DeepSeek SSE、同源透传、1–20 字节拆分、慢读、异常 EOF、400；lint/typecheck、现有 21/21 测试、build 通过。 |
| 06 React 流式消费与消息状态管理 | COMPLETED | [Day 06 课件](lessons/day-06-react-stream-state.md)：提问记录、增量终态、近底部跟随；lint/typecheck、已有 21/21 测试、build 通过；浏览器交互待手动验收。 |
| 07 AbortController 与 Node.js 取消传播 | IN_PROGRESS | [Day 07 课件](lessons/day-07-cancellation.md)：停止按钮与前端、代理、Fastify、模型信号链路；静态检查及已有测试通过，按用户要求未启动项目或运行 build，真实断连待验收。 |
| 08 Partial JSON 与结构化数据渐进解析 | IN_PROGRESS | [Day 08 课件](lessons/day-08-partial-json.md)：Schema 和 1–20 字节 SSE 拆分已验；学习者提供真实 102 个 partial、analysis_done 及三字段完成截图。新增三列表格和失败路径待浏览器验收。 |
| 09 流式 Markdown 与 React 性能优化 | IN_PROGRESS | [Day 09 课件](lessons/day-09-markdown-performance.md)：体验逐次更新基线后，已加入 `requestAnimationFrame` 按帧合并；学习者未观察到基线明显卡顿，Profiler 对照和浏览器视觉待验。 |
| 10 Generative UI 安全组件注册表 | IN_PROGRESS | [Day 10 课件](lessons/day-10-generative-ui.md)：真实 DeepSeek 的受控 KPI/表格/柱状图协议和固定高度占位；静态检查、现有测试通过，模型输出与浏览器视觉待验。 |
| 11 Function/Tool Calling 运行机制 | IN_PROGRESS | [Day 11 课件](lessons/day-11-tool-calling.md)：公网示例任务经 DeepSeek 回答 20/11/9；另有六个固定日期订单练习，前五条无服务 SSE 已验，第六条模型回复及浏览器待验。 |
| 12 Zod 工具契约与描述设计 | IN_PROGRESS | [Day 12 课件](lessons/day-12-tool-contracts.md)：输入边界和订单 124/133/999 无服务检查通过；lint/typecheck、现有 21 项测试通过；真实模型/浏览器待验。 |
| 13 工具注册、服务端执行与权限边界 | IN_PROGRESS | [Day 13 课件](lessons/day-13-tool-registration-permissions.md)：受保护 AI 工具注册表与固定演示身份；未知工具、越权、只读角色无服务检查通过；真实登录态/模型待验。 |
| 14 参数校验失败与有界自纠错 | IN_PROGRESS | [Day 14 课件](lessons/day-14-bounded-tool-repair.md)：订单 view 错误最多一次修复；资格检查、lint/typecheck、现有测试通过；真实 DeepSeek 修复待验。 |
| 15 工具异常、超时、重试与幂等 | IN_PROGRESS | [Day 15 课件](lessons/day-15-tool-execution-reliability.md)：只读 GET 有界重试与工具错误码；公网正常/404/503、取消已执行，精确重试次数和浏览器待验。 |
| 16 前端 ContextCollector | IN_PROGRESS | [Day 16 课件](lessons/day-16-frontend-context-collector.md)：首页订单选择、白名单采集、双边请求校验与工具定位指令；合法/敏感字段/路由契约操作已验，浏览器与真实模型待验。 |
| 17 Token 预算与上下文裁剪 | IN_PROGRESS | [Day 17 课件](lessons/day-17-token-budget.md)：工具模式的文本粗估、先裁筛选再裁选中 ID、核心超预算拒绝；分级操作已验，真实 usage 和模型效果待验。 |
| 18 Sliding Window 与 Summary Memory | IN_PROGRESS | [Day 18 课件](lessons/day-18-conversation-memory.md)：文本模式只带完整问答对，近期窗口与旧对话按需摘要；22 轮裁剪操作已验，真实模型和浏览器待验。 |
| 19 Prompt Injection 与数据最小化 | IN_PROGRESS | [Day 19 课件](lessons/day-19-prompt-injection.md)：模型输入已知格式脱敏、工具字段收窄和服务端数据边界指令；四类样例已验，真实模型注入和浏览器待验。 |
| 20 会话隔离、并发与重复请求 | IN_PROGRESS | [Day 20 课件](lessons/day-20-session-concurrency.md)：页面会话 ID、请求键、服务端单进程并发/重放拒绝；无服务操作已验，浏览器及真实身份隔离待验。 |
| 21 StateGraph、Node、Edge 与条件路由 | COMPLETED | [Day 21 课件](lessons/day-21-stategraph-routing.md)：LangGraph 订单查询路由图；状态/详情、非法输入和递归上限已操作，lint/typecheck、现有测试通过。未接模型或工具。 |
| 22 把 Tools 接入 LangGraph Agent | COMPLETED | [Day 22 课件](lessons/day-22-tools-in-langgraph.md)：独立 DeepSeek → 受保护订单工具 → DeepSeek 回答图；真实 123 成功、999 越权拒绝，缺编号/未知工具已验。未接页面。 |
| 23 Checkpoint、thread_id 与持久化边界 | COMPLETED | [Day 23 课件](lessons/day-23-checkpoint-thread-id.md)：同线程计数 2、跨线程空、越权拒绝、独立进程新内存为空；持久方案见 [ADR](adr/day-23-checkpoint-persistence.md)。 |
| 24 HITL 中断与审批卡片 | COMPLETED | [Day 24 课件](lessons/day-24-hitl-interrupt.md)：独立图在订单写入前 interrupt；命令输出审批卡片数据和预览，订单状态未变。页面卡片、持久审批与安全 resume 尚未实现。 |
| 25 Resume、拒绝审批与安全恢复 | COMPLETED | [Day 25 课件](lessons/day-25-resume-safety.md)：单进程 `Command` resume 验证批准、拒绝、非审批人、过期、篡改、重复和订单版本变化；生产持久与并发保障未实现。 |
| 26 React Flow 工作流设计器 | IN_PROGRESS | [Day 26 课件](lessons/day-26-workflow-designer.md)：`/workflow` 画布、节点/边编辑与 JSON 预览已实现，lint/typecheck/现有测试通过；浏览器交互、长标签和手机布局待手动验收。 |
| 27 工作流版本化与静态校验 | IN_PROGRESS | [Day 27 课件](lessons/day-27-workflow-validation.md)：服务端版本/节点/边/环路校验和同源按钮已实现；命令与 Fastify 路由已验，浏览器点击待验。 |
| 28 Run 状态机与实时执行事件 | DEFERRED | 用户要求直接开始 Week 7；中断时留下部分未提交代码，未做完整验收，不算完成。 |
| 29 副作用保护与补偿策略 | DEFERRED | 用户要求跳过 Week 6 后续课程。 |
| 30 超时、重试、取消与恢复演练 | DEFERRED | 用户要求跳过 Week 6 后续课程。 |
| 31 企业分析工具与数据口径正确性 | COMPLETED | [Day 31 课件](lessons/day-31-business-analytics.md)：三种只读聚合、7/4 口径、无数据/逆日期/越权已验；真实 DeepSeek 运营商回答与工具结果一致。 |
| 32 RAG 数据摄取与检索基础 | IN_PROGRESS | [Day 32 课件](lessons/day-32-rag-ingestion-retrieval.md)：文档章节切块、版本/租户/角色过滤、MiniSearch 关键词检索和 API 已验；embedding/向量、页面和模型回答未实现。 |
| 33 混合检索、重排序与引用来源 | IN_PROGRESS | [Day 33 课件](lessons/day-33-citations-refusal.md)：原文引用、固定 source ID 和无证据拒答已验；混合检索、重排序及模型综合回答未实现。 |
| 34 Agent Golden Dataset 与回归评测 | IN_PROGRESS | [Day 34 课件](lessons/day-34-golden-dataset.md)：固定样本 33/34，K11 关键词漏召回；真实 DeepSeek Agent 评测待做。 |
| 35 Tracing、日志、Token 与延迟指标 | NOT_STARTED | - |
| 36 模型降级、限流、缓存与并发预算 | NOT_STARTED | - |
| 37 企业安全、RBAC、租户隔离与审计 | NOT_STARTED | - |
| 38 Docker、环境配置与 CI 检查 | NOT_STARTED | - |
| 39 端到端测试与故障注入 | NOT_STARTED | - |
| 40 最终演示、架构复盘与模拟面试 | NOT_STARTED | - |

## 旧课程记录

- 原 L00 已在前一轮完成，证据位于 [L00 历史课件](lessons/L00-repository-bootstrap.md)。本轮 Day 01 复用代码，重新运行验收并形成独立课件。

## 当前问题

- Day 11 最终选择 JSONPlaceholder 公网示例任务 API：用户 1 总数 20、完成 11、未完成 9；真实 DeepSeek 回答一致且注明示例性质，出站计数 1 次。先试 DummyJSON 时曾成功读取，但后续 Node 连接多次超时；JSONPlaceholder 链路最终复测通过。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）、`git diff --check` 均 exit 0。未启动项目、未运行 build，也未做浏览器交互或断连验收。

- Day 10 `echarts` 安装完成，`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）、`git diff --check` 均 exit 0；已有测试不覆盖新增可视化链路。按要求未启动项目、未运行 build、未调用真实 DeepSeek；三种输出、窄屏和布局偏移仍待手动验收。

- Day 09 新增 react-markdown/remark-gfm；先前无服务渲染检查的 GFM 表格、HTML/图片/危险链接禁用和未闭合围栏降级四项通过。学习者体验逐次更新基线后未观察到明显卡顿，随后要求加入 `requestAnimationFrame`；现已加入按帧合并，Profiler 对照尚未测量。调整后 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）、`git diff --check` 均 exit 0。未启动项目或运行 build。

- Day 08 曾执行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）和 `git diff --check`，均 exit 0；Schema 与结构化 SSE 1–20 字节拆分操作通过。学习者随后提供真实 DeepSeek 的 102 个 partial、analysis_done 和原页面完成截图。新增表格及异常断流仍待浏览器验证；本轮未启动项目或运行 build，见 [Day 08 课件](lessons/day-08-partial-json.md)。

- Day 07 本轮实际执行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test` 和 `git diff --check`，均 exit 0；已有 API 15/15、Web 6/6 测试不覆盖取消传播。未启动项目、未运行 build，也未实际验证浏览器断开后 Fastify 和 DeepSeek 是否停止；详见 [Day 07 课件](lessons/day-07-cancellation.md)。

- 本轮整理后最终 `pnpm lint`、`pnpm typecheck`、`pnpm test`（API 15/15、Web 6/6）、`pnpm build` 均 exit 0；首页和 `/health` 返回 200。真实场景题发现默认思考模式会耗尽输出 token 并导致 502，修正为关闭思考模式、1024 token 上限、拒绝截断结果后，面试题和订单审批题均从同源入口返回 200 与正文。细节见 Day 04 课件；未做浏览器自动点击或手机截图。

- 独立 Gemini 原始大纲文件未在仓库找到；现阶段只可对照最终总控中已整合的五部分和明确知识点。详情见 [覆盖矩阵](COVERAGE_MATRIX.md)。
- 课程顺序从 16 课切为 40 Day、Day 03 提前实施和 Day 02 补课的依据及版本敏感 API 风险见 [决策日志](DECISION_LOG.md)。
- 页面手机宽度视觉检查留给学习者手动验收；未宣称自动视觉测试通过。
- 当前只支持 SSE 增量回复；Day 04 的非流式接口已按用户要求删除，历史课件仅保留当时的学习记录。Day 07 已接上浏览器到模型的取消信号，但未做运行时断连验收；没有会话记忆、断线重放、工具调用或鉴权。API 缺 Key 不启动，且只绑定回环地址；公开部署前必须补鉴权、限流与成本控制。
- Day 05 的浏览器自动点击与手机截图未执行：本机 Work 设置禁用本地浏览器控制。真实 401/429、供应商中途故障和断线重连也未验证；详见 Day 05 课件。
- 用户提供的 DeepSeek Key 曾出现在对话中；已再次提醒轮换，不能把 Git ignore 当作轮换替代。
