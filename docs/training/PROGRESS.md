# 学习进度

更新日期：2026-10-27。**Day 01 已完成；等待用户检查，不自动进入 Day 02。** 课程顺序以 [40 Day 总表](CURRICULUM.md) 为准，旧 L00–L15 编号只用于追溯；既有 L00 骨架与记录保留，本轮已独立复测并生成 Day 01 课件。

| Day | 状态 | 证据/下一步 |
| --- | --- | --- |
| 01 仓库体检与最小全栈骨架 | COMPLETED | [Day 01 课件](lessons/day-01-repository-bootstrap.md)：锁文件安装、lint、typecheck、3/3 测试、build；Web/API 200，异常请求 404 |
| 02 开发环境、API 契约与错误边界 | NOT_STARTED | 等待 Day 01 验收与用户指示 |
| 03 模型服务适配层与密钥安全 | NOT_STARTED | - |
| 04 第一次非流式 LLM 调用 | NOT_STARTED | - |
| 05 流式协议入门与 SSE 帧解析 | NOT_STARTED | - |
| 06 React 流式消费与消息状态管理 | NOT_STARTED | - |
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

- 独立 Gemini 原始大纲文件未在仓库找到；现阶段只可对照最终总控中已整合的五部分和明确知识点。详情见 [覆盖矩阵](COVERAGE_MATRIX.md)。
- 课程顺序从 16 课切为 40 Day 的依据和版本敏感 API 风险见 [决策日志](DECISION_LOG.md)。
- 页面手机宽度视觉检查留给学习者手动验收；未宣称自动视觉测试通过。
