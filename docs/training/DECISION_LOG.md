# 课程与技术决策日志

新想法先写入“待决策”；只有用户明确同意才调整 [40 Day 总表](CURRICULUM.md) 的顺序或技术栈。已锁定的决定也要记录依据、影响和验证方式。

## 已锁定

| ID / 日期 | 决策 | 依据与影响 | 验证 |
| --- | --- | --- | --- |
| D-001 / 2026-10-27 | 课程顺序改用固定 40 Day；旧 L00–L15 保留为主题来源和历史记录。 | 用户本轮明确要求严格执行第二份文件的完整 Day 指令。它与最终总控第 5/10 节的 16 课顺序冲突；用户指令优先，最终总控的安全和教学规则继续适用。 | `CURRICULUM.md` 共 40 个连续 Day；`COVERAGE_MATRIX.md` 逐项映射旧 16 课。 |
| D-002 / 2026-10-27 | Day 01 复用当前 Next.js/Fastify 最小骨架，并独立复测、写新课件；不覆盖旧 L00 课件。 | 当前仓库已有可运行工程，第二份文件要求先读现有文件且不得覆盖。 | Day 01 执行命令和 HTTP 结果记在独立课件。 |
| D-003 / 2026-10-27 | Day 01 不安装 AI SDK、LangGraph、Zustand、ECharts、React Flow。 | 总控要求按课程渐进引入；40 Day 计划分别从 Day 03/06/10/21/26 开始。 | 查看 package 和锁文件；Day 01 只验收 Dashboard/health。 |
| D-004 / 2026-10-27 | 模型供应商选定 DeepSeek；密钥只通过服务端环境变量提供，不写入仓库、前端或课程文档。 | 用户已确认按原顺序推进：Day 02 建立安全配置边界，Day 03 实现 provider adapter，Day 04 验证首次模型调用。 | 到相应 Day 核对 DeepSeek 官方 API、AI SDK 兼容方式与安装版本，使用 Mock 和受控真实请求验证。 |
| D-005 / 2026-10-27 | 应用户最新明确要求，先执行 Day 03；Day 02 延期，保留原主题和前置缺口。 | 最新指令覆盖了之前“按原顺序”的选择。为安全接入，只实现 Day 03 所需的本地密钥与模型 ID 校验；共享 API 契约、requestId、统一错误边界仍属 Day 02，Day 04 不提前开始。 | Day 03 单独课件、真实测试；进度表将 Day 02 标为 DEFERRED。 |
| D-006 / 2026-10-27 | 用户明确要求补做 Day 02；保留 Day 03 已完成事实，不重写历史顺序。 | 新增独立 contracts 工作区供 Next/Fastify 共用；API 使用服务端生成 UUID，Web 服务端只读健康检查；不接聊天或模型请求。 | Day 02 独立课件、25 个测试、lint/typecheck/build、真实 HTTP 与页面状态；Day 02 改为 COMPLETED。 |
| D-007 / 2026-10-27 | Day 04 默认 Mock；显式 `MODEL_PROVIDER=deepseek` 才在服务端使用真实 Key。 | 单次问答通过 Next 同源入口转到 Fastify；限制 500 字输入、128 输出 token、20 秒模型超时、零自动重试；真实模式只允许 API 回环地址绑定。尚无鉴权或限流，只适合可信本地演示。 | Mock/DeepSeek 实际 HTTP、504/503/502 故障注入、非法外网绑定启动拒绝、构建与课件；Day 36–37 补生产保护。 |
| D-008 / 2026-10-27 | 用户要求后续不再新增或修改 `.test.ts` 单元测试代码。 | 保留并运行已有测试；新课程用实际 HTTP、运行时故障注入、构建与手动验收记录证据，不把旧测试结果说成新功能覆盖。 | Day 04 没有改动任何 `.test.ts`；实际命令见课件。 |
| D-009 / 2026-10-27 | 用户明确要求删除全部 Mock 模型逻辑，当前项目直接使用 DeepSeek。 | 覆盖 D-007 的默认 Mock 模式与原课程 Mock 排程；删除 Mock provider、模式开关、页面标签及专属旧测试文件。API 缺 Key 启动失败，仅绑定回环地址。历史课件保留当时测试事实，顶部注明已被本决定取代。 | 代码搜索、21/21 保留测试、lint/typecheck/build、缺 Key 启动失败、Next 同源真实 DeepSeek 返回 `OK` 和 `4`。 |
| D-010 / 2026-10-27 | 现行界面与文档以面试题和真实工程情境为主线；移除未实现模块占位和重复模型 smoke 脚本。 | 主页只提供单次真实 DeepSeek 问答，预设题目是学习提示，不代表已连接订单或知识库；保留 `/health` 作为基础 API 状态。Day 01–04 历史测试结果另行标注，不改写成当前结果。 | 本轮 lint/typecheck、21/21 现有测试、build、首页/health HTTP 200、同源 DeepSeek 200/`OK`；未做浏览器点击自动化。 |
| D-011 / 2026-10-27 | Day 04 的文本问答关闭 DeepSeek V4 默认思考模式，输出上限改为 1024 token，并拒绝长度截断。 | 实际面试题在 128 token 时返回 502；诊断显示 512 token 全耗在 reasoning，关闭思考后 512 token 的正文又被截断。单次练习优先得到可读完整答复；明确限制输出与收费，不把半截正文标为成功。 | 同源面试题、订单审批场景题均返回 200/正文；空白输入 400。最终 lint/typecheck/test/build 结果记在 Day 04。 |
| D-012 / 2026-10-28 | Day 05 使用自定义、共享契约的 SSE 文本事件，保留 Day 04 完整回复作对照。 | 当前问题需 POST body；Fastify 从真实 DeepSeek `textStream` 编帧，Next 透传，浏览器增量 UTF-8 解码并等 `done`。事件 ID 仅关联顺序，无重放/取消语义；不引入模拟模型或 Day 06 状态库。 | 真实流 200、多 delta/`done`；1–20 字节拆分、慢读与异常 EOF；空白/坏 JSON 400；lint/typecheck、现有 21/21 测试、build。浏览器自动化因 Work 设置不可用。 |
| D-013 / 2026-10-28 | Day 06 用单组件 React state 保存页面提问记录。 | 当前没有跨组件会话状态，暂不安装 Zustand；记录不发送给模型。只在接近底部时跟随滚动。 | lint/typecheck、现有 21/21 测试、build 通过；浏览器交互待手动验收。 |
| D-014 / 2026-10-28 | 用户要求删除全部非流式回复代码，当前只保留 DeepSeek SSE 问答。 | 删除页面模式切换、Next/Fastify 非流式路由、`generateText` 方法与完整回复契约；Day 04 历史课件保留当时事实。后续代码关键流程用中文注释；不运行 build 或启动项目。 | 以本次 lint/typecheck/现有测试和代码搜索记录为准。 |
| D-015 / 2026-10-28 | Day 07 连接浏览器、代理、Fastify 和 DeepSeek 的取消信号，进度暂记进行中。 | 用户要求不启动项目或运行 build；静态检查不能证明实际断连或供应商停止计费。 | lint/typecheck/已有测试；运行时点击停止、卸载与断连待手动验收。 |
| D-016 / 2026-10-28 | Day 08 复用文本 SSE 路由，增加 `format=analysis` 和部分对象事件。 | 当前 AI SDK 7 提供 `Output.object()`/`partialOutputStream`；部分字段只预览，完整对象校验后才发 `analysis_done`。本地类型检查直接解析契约源码，以遵守不运行 build 的要求。 | Schema 与 1–20 字节拆分操作验收；真实 DeepSeek 兼容性待运行时验证。 |
| D-017 / 2026-10-28 | Day 09 使用 react-markdown + remark-gfm 展示文本流，按浏览器帧合并状态更新。 | Markdown 不执行原始 HTML，禁模型图片及危险链接；未闭合围栏先显示原文。用户要求不启动项目/运行 build，浏览器 Profiler 留待手动验收。 | lint/typecheck/旧测试、无服务渲染检查；视觉与性能数据待验。 |

## 待决策与风险

| ID | 问题 | 当前处理 | 影响 Day / 验证来源 |
| --- | --- | --- | --- |
| P-001 | 仓库没有独立 Gemini 原始大纲文件，无法与其逐字核对。 | 覆盖矩阵按最终总控 §3.1 已整合的五部分和第二份指令 E 节逐项建立；若以后提供原件，再补差异行。 | 全课程；仓库文件清单。 |
| P-002 | AI SDK 的流协议、partial API、abort/resume 兼容性会随版本变化。 | Day 03–10、30 实施时检查安装版本、官方文档、类型和测试；现阶段只排程。 | 03–10、30；总控 §3.1/§9、官方 SDK 文档。 |
| P-003 | `@streamparser/json`、`parsePartialJson` 与 SDK partial output 的适用边界须实测。 | Day 08 对比原始 JSON 增量流和 SDK 结构化流；不得用正则补全任意 JSON。 | 08；实际版本、类型和异常 EOF 测试。 |
| P-004 | LangGraph 的 `StateGraph`、`interrupt()`、`Command`、checkpointer API 和持久后端待确定。 | Day 21–25 才安装核对；MemorySaver 只作进程内示例，不能当重启恢复方案。 | 21–25；LangGraph 官方文档和重启测试。 |
| P-005 | 本机 pnpm 7.9.0 可完成 Day 01，但未来依赖可能要求更高版本。 | 不擅自升级；到具体安装 Day 检查 engines、锁文件和实际命令，再提出兼容方案。 | 03、21 等安装日；包元数据与安装结果。 |
| P-006 | 同一个 DeepSeek 密钥已经出现在对话记录中。 | 本轮密钥仅保存在 Git 忽略且文件权限为 600 的 `apps/api/.env.local`；不写入日志、文档或前端。建议用户在 DeepSeek 控制台轮换后更新本地文件。 | 03；`git check-ignore`、文件权限与轮换后的连通性检查。 |
