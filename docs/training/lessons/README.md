# 每日课件索引

课程顺序见 [40 Day 总表](../CURRICULUM.md)，进度见 [PROGRESS](../PROGRESS.md)，知识点位置见 [覆盖矩阵](../COVERAGE_MATRIX.md)。只在开始并实际验证某个 Day 时创建 `day-XX-*.md`，不提前生成未来课程的空课件。

跨课程查阅： [SSE 流式请求生命周期与取消速查](../SSE-STREAM-LIFECYCLE.md)，集中说明停止、弱网、断网、关闭浏览器、正常完成与超时。

| 课件 | 说明 |
| --- | --- |
| [Day 01：仓库体检与最小全栈骨架](day-01-repository-bootstrap.md) | 当前 40 Day 路线中的首课，独立验收当前工程。 |
| [Day 02：开发环境、API 契约与错误边界](day-02-api-contracts.md) | 在 Day 03 之后补做；共享 Schema、配置、错误体、请求 ID 和页面连接检查。 |
| [Day 03：DeepSeek 模型服务适配](day-03-deepseek-provider.md) | 以当前服务端调用与密钥安全为主，末尾保留历史验收摘要。 |
| [Day 04：第一次非流式 LLM 调用](day-04-first-llm-call.md) | 面试题/场景问答的现行链路、验收与三道面试题。 |
| [Day 05：流式协议入门与 SSE 帧解析](day-05-sse-streaming.md) | 真实 DeepSeek SSE、拆帧与 UTF-8 验收、完整/流式对照及边界。 |
| [Day 06：React 流式消费与消息状态管理](day-06-react-stream-state.md) | 多次提问记录、增量状态、失败片段和滚动跟随。 |
| [Day 07：AbortController 与 Node.js 取消传播](day-07-cancellation.md) | 代码与静态检查完成；运行时断连待验收。 |
| [Day 08：Partial JSON 与结构化数据渐进解析](day-08-partial-json.md) | 部分对象预览、最终 Schema 校验和拆帧操作验收；真实模型待验。 |
| [Day 09：流式 Markdown 与 React 性能优化](day-09-markdown-performance.md) | GFM 安全渲染、未闭合围栏降级和按帧合并；视觉及 Profiler 待验。 |
| [Day 10：Generative UI 安全组件注册表](day-10-generative-ui.md) | DeepSeek 只输出受控 KPI/表格/柱状图数据；真实输出与视觉待验。 |
| [Day 11：Function / Tool Calling 运行机制](day-11-tool-calling.md) | JSONPlaceholder 示例任务统计工具；真实 HTTP 与 DeepSeek 回答已验，浏览器展示待验。 |
| [Day 12：Zod 工具契约与描述设计](day-12-tool-contracts.md) | 订单编号、视图枚举、可选和可空字段；真实工具选择待验。 |
| [Day 13：工具注册、服务端执行与权限边界](day-13-tool-registration-permissions.md) | 受保护工具白名单、演示身份范围和越权拒绝；真实登录态待接入。 |
| [Day 14：参数校验失败与有界自纠错](day-14-bounded-tool-repair.md) | 订单 view 错误至多修一次；缺字段和权限拒绝停止。 |
| [Day 15：工具异常、超时、重试与幂等](day-15-tool-execution-reliability.md) | 公网只读统计的有界重试、超时和独立错误码；写工具幂等边界。 |
| [Day 16：前端 ContextCollector](day-16-frontend-context-collector.md) | 首页订单选择的白名单上下文采集；浏览器及模型链路待验。 |
| [Day 17：Token 预算与上下文裁剪](day-17-token-budget.md) | 工具模式应用文本预算、优先级裁剪和输出预留；真实用量待验。 |
| [L00：仓库体检与项目骨架](L00-repository-bootstrap.md) | 旧 16 课体系的历史课件，保留用于追溯。 |

每个新课件必须包含本课目标/前置、概念与流程、具体文件和**可对照源码的重点代码片段及中文说明**、通用五坑、本课专项五坑、至少三道完整面试问答、实际测试和边界、可量化验收与证据、本课小结与复盘、Git commit 建议和下一课依赖。没有运行的测试标“未执行”。
