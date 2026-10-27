# AI Native Console：Codex 第一条指令（先锁定全部 Day 课程，再执行 Day 01）

> 目标：先建立完整、可追踪、不随意漂移的 40 个学习日课程路线图；随后只执行 Day 01。技术栈统一为 TypeScript 全栈，Node.js 作为后端。

## 发给 Codex 的第一条指令

请先完整阅读仓库根目录中的最终课程总控文档，以及仓库内所有 `AGENTS.md`、README、现有课程进度和架构说明。若总控文档文件名不同，请先检查实际文件，不要自行假设文件不存在。

我的背景是 5 年 React / TypeScript 前端经验，目前没有系统开发过 AI Agent。我的目标是通过一个完整、可运行、可演示、可接受面试追问的项目，转向 AI 前端、AI 应用工程师或 AI Agent 工程师岗位。

项目名称：**AI Native Console — 企业级 AI 驱动智能分析与工作流 Agent 系统**。

### A. 总控规则：必须先建立完整课程地图

1. **不要直接开始写业务代码。先完成全部 40 个 Day 的课程总表。** 不允许只写“L00–L15”这种阶段标题，也不允许只规划最近一周。
2. 把下面的 40-Day 课程目录写入 `docs/training/CURRICULUM.md`，不可静默删减、合并、换序或跳过。若发现依赖冲突，可以提出方案，但先记录为待决策项，不得擅自改变范围。
3. 同时建立 `docs/training/COVERAGE_MATRIX.md`：逐项映射用户提供的课程大纲中的每一个知识点、五大深水坑、代码实践和面试题，到具体 Day；必须标记覆盖状态（已安排 / 需补强 / 未安排）。不能用“涉及 AI”“包含 Agent”等模糊表述代替。
4. 同时建立 `docs/training/PROGRESS.md`、`docs/training/DECISION_LOG.md`、`docs/training/interview-question-bank.md` 和 `docs/training/lessons/README.md`。
5. 先完成全体课程地图与覆盖矩阵，然后输出摘要说明：总 Day 数、每周主题、核心交付物、覆盖缺口、技术依赖和风险。**不要在同一轮自动把 Day 02 及以后实现出来。**
6. 路线图完成后，可以继续执行 Day 01（仅 Day 01）。Day 01 验收完成后必须停下，等待我明确指示进入 Day 02。

### B. 固定技术栈与版本原则

- 前端：Next.js App Router、React、TypeScript、Tailwind CSS；后续根据课程再引入 Zustand、ECharts、React Flow。
- 后端：Node.js + TypeScript + Fastify。只有当仓库已有成熟 Express 项目时才沿用 Express；不同时引入 Express 和 Fastify。
- LLM/UI Streaming：Vercel AI SDK 与其 OpenAI provider，具体 API 必须依据实际安装版本和官方文档核对。
- 数据校验：Zod；后续将其用于工具参数和边界契约。
- Agent 编排：LangGraph.js，按课程安排引入。
- 数据持久化：先采用适合本地开发的方案，课程中明确区分内存开发 Checkpointer 与生产级持久化方案；不得声称 MemorySaver 可跨进程重启持久化。
- 图表与工作流：ECharts、React Flow 在对应课程再安装和实现。
- 所有密钥只能存在服务端环境变量；严禁放入 Next.js `NEXT_PUBLIC_` 变量或提交到 Git。
- 用锁文件固定真实依赖版本。遇到 API 变动，核对官方文档和类型定义，不照抄过时博客示例。

### C. 固定的 40-Day 课程目录

#### Week 1 — 项目底座与第一次模型交互

- **Day 01：仓库体检与最小全栈骨架** — 检查环境和已有文件；建立 Next.js 前端、Fastify `/health`、脚本、测试和文档。
- **Day 02：开发环境、API 契约与错误边界** — 环境变量、配置校验、统一错误格式、requestId、前后端 API 契约。
- **Day 03：模型服务适配层与密钥安全** — provider adapter、服务端密钥管理、模型配置、Mock provider。
- **Day 04：第一次非流式 LLM 调用** — system/user/assistant 消息、超时、异常、输出限制与最小评测样例。
- **Day 05：流式协议入门与 SSE 帧解析** — HTTP streaming、SSE 帧、网络 chunk 边界、事件协议与基础前后端联通。

#### Week 2 — Streaming、Partial JSON 与 Generative UI

- **Day 06：React 流式消费与消息状态管理** — 消息状态机、增量文本、滚动策略、加载/完成/失败状态。
- **Day 07：AbortController 与 Node.js 取消传播** — 用户取消、页面卸载、请求断连、模型请求取消和资源清理。
- **Day 08：Partial JSON 与结构化数据渐进解析** — 不完整 JSON 的安全解析、增量解析器、何时可展示部分字段、何时必须等待完整验证。
- **Day 09：流式 Markdown 与 React 性能优化** — 未闭合代码块、批处理/节流、避免无效重渲染、长文本性能测试。
- **Day 10：Generative UI 安全组件注册表** — 受控图表/表格/卡片 schema、组件白名单、骨架占位、固定尺寸与布局偏移测试。

#### Week 3 — Tool Calling 与可靠的工具执行

- **Day 11：Function/Tool Calling 运行机制** — 模型提出调用、应用执行、工具结果回传、普通回答与工具调用的差异。
- **Day 12：Zod 工具契约与描述设计** — 参数 schema、enum、optional/nullable、description、输入输出类型推导。
- **Day 13：工具注册、服务端执行与权限边界** — 工具 allowlist、身份上下文、租户过滤、客户端与服务端职责。
- **Day 14：参数校验失败与有界自纠错** — 结构化错误回传、最多重试次数、总时间/成本预算、不可修复错误路径。
- **Day 15：工具异常、超时、重试与幂等** — 工具调用错误分类、指数退避、不可重试错误、重复执行防护和故障测试。

#### Week 4 — Context Engineering、Memory 与安全

- **Day 16：前端 ContextCollector** — 页面 route、选中行、筛选器和当前任务的白名单采集；避免收集整个 DOM 或敏感信息。
- **Day 17：Token 预算与上下文裁剪** — token 估算、上下文预算、字段裁剪、优先级和成本观测。
- **Day 18：Sliding Window 与 Summary Memory** — 保留系统指令、完整消息组裁剪、摘要生成/更新、摘要不等于事实来源。
- **Day 19：Prompt Injection 与数据最小化** — 不可信内容隔离、工具输出视为数据、密钥和 PII 脱敏、服务端权限不依赖 Prompt。
- **Day 20：会话隔离、并发与重复请求** — session/thread 归属、并发消息策略、旧请求竞态、幂等 request key 与状态一致性。

#### Week 5 — LangGraph.js 与 Human-in-the-Loop

- **Day 21：StateGraph、Node、Edge 与条件路由** — 状态 schema、节点职责、条件边、终止条件和流程可视化。
- **Day 22：把 Tools 接入 LangGraph Agent** — 模型节点、工具节点、ToolNode/等价机制、循环限制和调用轨迹。
- **Day 23：Checkpoint、thread_id 与持久化边界** — MemorySaver 的适用范围、持久化 checkpointer、线程隔离和恢复测试。
- **Day 24：HITL 中断与审批卡片** — 高风险动作之前暂停、展示 action preview、审批主体与审批依据。
- **Day 25：Resume、拒绝审批与安全恢复** — 恢复状态、审批令牌/用户鉴权、重复审批、并发恢复和中断后的测试。

#### Week 6 — 工作流系统与可追踪执行

- **Day 26：React Flow 工作流设计器** — 节点类型、连线、布局、前后端工作流 JSON 契约。
- **Day 27：工作流版本化与静态校验** — 节点/边校验、非法环路、缺失参数、版本号和发布前验证。
- **Day 28：Run 状态机与实时执行事件** — queued/running/waiting_approval/succeeded/failed/cancelled，SSE 事件与运行日志。
- **Day 29：副作用保护与补偿策略** — 幂等键、操作预览、审批、重放风险、补偿动作和审计日志。
- **Day 30：超时、重试、取消与恢复演练** — 节点级 timeout/retry、最大迭代次数、断线重连、取消语义和故障注入。

#### Week 7 — 企业数据分析、RAG 与评估

- **Day 31：企业分析工具与数据口径正确性** — 只读查询、时间区间、聚合指标、合法过滤条件、数值来源与 SQL 安全边界。
- **Day 32：RAG 数据摄取与检索基础** — 文档切分、metadata、embedding、向量检索、版本更新与访问权限。
- **Day 33：混合检索、重排序与引用来源** — 召回/排序、引用片段、无答案拒答、检索失败与过时文档。
- **Day 34：Agent Golden Dataset 与回归评测** — 工具选择正确率、参数正确率、任务完成率、引用正确性和失败样本复盘。
- **Day 35：Tracing、日志、Token 与延迟指标** — run/trace/span、工具输入输出脱敏、成本统计、错误率和可观测性面板。

#### Week 8 — 生产化、部署与面试通关

- **Day 36：模型降级、限流、缓存与并发预算** — 多 provider 适配、fallback、rate limit、cache key、熔断与成本上限。
- **Day 37：企业安全、RBAC、租户隔离与审计** — 服务端鉴权、资源归属校验、最小权限、敏感操作审计和威胁建模。
- **Day 38：Docker、环境配置与 CI 检查** — 可复现启动、测试流水线、密钥管理、健康检查和部署文档。
- **Day 39：端到端测试与故障注入** — Mock LLM、断流、超时、工具失败、恶意输入、重复点击和多会话隔离测试。
- **Day 40：最终演示、架构复盘与模拟面试** — 端到端 demo、架构图、技术取舍、指标报告、简历措辞和真实项目边界。

### D. 每个 Day 的固定交付格式（不可省略）

每个 Day 必须在 `docs/training/lessons/day-XX-*.md` 中单独建立课件，且必须包含：

1. 本课目标、前置知识、为什么在真实项目中需要它。
2. 核心概念与执行流程图（Mermaid 可选）。
3. 要改动的具体文件、实现步骤、可运行代码和关键代码解释。
4. **通用五大深水坑**：流式/Partial JSON、Tool Calling 无效参数、Context/Token、HITL 与高危动作、Abort/断流/恢复；若某项尚未在当前阶段实践，也要说明本阶段如何认识与避免，不能伪称已经实现。
5. **本课专项五大深水坑**：列出五项具体失效场景、触发条件、表现、原因、处理方案和测试方法。
6. **模拟面试考场至少 3 题**：每题包含问题、推荐回答、面试官追问、追问回答、常见错误答案及原因。回答只能陈述项目里实际实现/验证的内容；未实现内容必须作为设计方案说明，不能包装成工作经历。
7. 测试计划与实际执行命令、结果、边界用例；未执行的测试必须明确标为未执行。
8. 可量化验收标准、手动验收步骤、截图/日志/测试报告等证据位置。
9. 本课小结、复盘问题、Git commit 建议和下一课依赖。
10. 更新 `PROGRESS.md`、`COVERAGE_MATRIX.md`、`interview-question-bank.md`，并记录尚未解决的问题。

说明：通用五大坑作为全课程贯穿的安全/可靠性检查表，每课必须回顾其与本课的关联；本课专项坑要按不同主题变化，不能机械复制同一段文字。

### E. 课程地图的质量标准

`CURRICULUM.md` 每个 Day 至少要有这些列：Day、主题、学习目标、关键知识点、项目产物、测试/验收、面试覆盖、前置依赖、预计用时、状态。

`COVERAGE_MATRIX.md` 必须逐项纳入且逐项定位：
- SSE vs Request/Response vs WebSocket、SSE 帧解析与 chunk 边界；
- Streaming Partial JSON、`@streamparser/json` / `parsePartialJson` 的适用区别与版本核验；
- Generative UI 渐进式渲染、组件白名单、骨架、布局稳定；
- AbortController、客户端断连到后端模型取消的传播；
- 流式高频重渲染、Markdown 未闭合、资源泄漏；
- Function Calling、Zod、工具 description、服务端执行；
- 参数错误的有界 Self-Correction、最大重试与成本阀门；
- LangGraph.js StateGraph、节点、条件边、循环限制；
- Checkpoint、MemorySaver 的限制、持久化与恢复；
- HITL interrupt / resume、审批身份校验、重复审批与高危副作用保护；
- ContextCollector、Sliding Window、Summary Memory、Token 预算；
- Prompt Injection、PII 脱敏、JWT/密钥不能进入 Prompt；
- thread/session 隔离、并发状态竞争、request cancellation、断线续接边界；
- React、Next.js App Router、Zustand、Tailwind CSS、ECharts、React Flow；
- Vercel AI SDK 与 LangGraph.js 各自职责及集成边界；
- Node.js 错误处理、超时、重试、限流、幂等、日志、部署；
- RAG、向量检索、引用、无答案处理和评测；
- 面试中常见的 Agent vs Workflow、Tool Calling、RAG vs Context Engineering、模型评估、安全、生产可观测性、架构取舍。

### F. 防止课程漂移的规则

1. `CURRICULUM.md` 是唯一的课程顺序依据；任何临时新想法先写入 `DECISION_LOG.md` 的“待决策”，不能直接打乱 Day 顺序。
2. 只有我明确同意后，才可以修改课程顺序或技术栈；如果官方 API 变化必须调整实现，在决策日志注明原因、影响 Day、替代方案与验证来源。
3. 每次开始新 Day 前，先读取课程总表、进度和覆盖矩阵，确认前置课程已验收。
4. 每次只执行一个 Day；不得为了看起来完整而创建未验证的大量代码。
5. 不允许编造测试结果、准确率、延迟优化数字或生产落地经历。
6. 不允许用正则随意“补全”任意 JSON 作为可靠解析方案；必须讲清部分解析与最终 schema validation 的边界。
7. 客户端 abort 不等于服务端副作用回滚；前后端取消、任务状态和持久化恢复必须分别验证。
8. MemorySaver/内存状态只能作为本地阶段方案，不能宣称可在进程重启、多实例部署下保证恢复。
9. 不把 prompt 当作权限机制；服务端必须对每个工具请求进行用户身份、资源归属与权限校验。
10. 每次完成一个 Day 后必须停下等待我的明确指令，不得自动进入下一 Day。

### G. 本次实际执行范围

请按顺序完成：

**第一步：只读检查仓库。** 读取现有课程总控文件、`AGENTS.md`、目录、Git 状态和 package 配置，不覆盖现有工程。

**第二步：创建完整课程管理文档。** 至少写入 `CURRICULUM.md`、`COVERAGE_MATRIX.md`、`PROGRESS.md`、`DECISION_LOG.md`、`interview-question-bank.md`、`lessons/README.md`。40 个 Day 必须全部列出，并对用户提供的 Gemini 课程大纲逐条映射。

**第三步：输出课程计划审查摘要。** 指出哪里完整覆盖、哪里有技术风险、哪些 API 需要在正式实现时核对官方文档。不要声称已经验证尚未执行的代码。

**第四步：只执行 Day 01。** 完成最小全栈骨架和 Day 01 课件，运行实际测试；不接模型、不实现 Agent、不提前执行 Day 02。

**第五步：停下汇报。** 输出课程地图位置、Day 01 改动、实际测试结果、验收方式、至少 3 道面试题和尚待确认的风险，然后等待我指示。

请现在开始。先核对仓库，不要向我重复询问已经能从现有文件中查到的信息。

---

## 用户执行后应得到的课程管理文件

```text
docs/training/
├── CURRICULUM.md                 # 全部 40 个 Day 的完整路线图
├── COVERAGE_MATRIX.md            # 原始大纲/知识点/深水坑/面试点逐项映射
├── PROGRESS.md                   # 当前 Day、状态、验收证据、下一步
├── DECISION_LOG.md               # 技术决策及课程变更记录
├── interview-question-bank.md    # 按主题与 Day 索引的面试题库
└── lessons/
    ├── README.md
    └── day-01-repository-bootstrap.md
```

Day 02 以后只先写入总表，不提前生成所有详细课件或实现代码。每课开始时再创建该课的完整课件与代码变更，避免一次性生成大量不准确内容。
