# Day 09：流式 Markdown 与 React 性能优化

日期：2026-10-28。状态：**IN_PROGRESS**。学习者已体验逐次 delta 更新的基线版本，未观察到明显卡顿；现按学习者要求加入 `requestAnimationFrame`。浏览器中的提交次数及性能收益仍待测量。

## 1. 目标、前置与完成定义

前置：Day 05–08 的文本 SSE、消息状态、取消和结构化模式。文本问答用 Markdown 展示列表、代码块、链接和 GFM 表格；结构化分析仍用 Day 08 的固定三列表格。学习顺序是先体验逐次更新，再加入按帧合并，最后测量并比较。当前没有证据表明原实现造成可感知卡顿，也没有按帧合并的收益数据。

## 2. 概念与数据流

模型可能把 `**粗体`、半个链接或未闭合的代码围栏分多次送来。每个 `delta` 都是纯文本片段，先由 Day 05 的 SSE 解析器合并为完整当前文本，再交给 Markdown 渲染器。生成中的语法树会变化，因此未闭合代码围栏时先按原文展示；闭合后再按 Markdown 渲染。Markdown 是模型生成的不可信内容，渲染器忽略原始 HTML，不加载模型给出的图片，链接使用安全 URL 策略。

基线版本每次收到 `delta` 的完整文本快照就调用 `setState`。学习者在真实 DeepSeek 输出和浏览器 CPU 限速下仍未观察到明显卡顿。现用 `requestAnimationFrame` 把同一帧内的多个快照合为一次更新；React 也可能自动批处理，所以不能仅凭代码推断实际减少了多少提交。

## 3. 动手过程：先观察，再优化

1. **基线实现**：每次收到完整文本快照就更新页面。核心代码见下一节；这是加入优化前的实际版本。
2. **观察结果**：学习者用真实 DeepSeek 长回答及浏览器 CPU 限速尝试，未感觉到明显卡顿；未记录 Profiler 提交次数或耗时。这个结果不能写成“基线很卡”。
3. **提出假设并实施**：按学习者要求加入 `requestAnimationFrame`，同一帧只提交最新的**完整文本快照**。`done` 自带完整正文，取消待绘制帧后直接完成；停止和异常结束先保留尚未绘制的片段。
4. **对照复测**：在 React DevTools Profiler 录制相近长度和格式的真实回答，记录 Network 的 `delta` 数、Profiler 提交次数、最慢提交和最终文本。模型每次输出不同，结果只是工程观察；目前尚未完成复测，不声称优化有效。

## 4. 文件和重点代码

| 文件 | 作用 |
| --- | --- |
| `apps/web/app/markdown-reply.tsx` | react-markdown + remark-gfm，限制 HTML/图片/链接，处理未闭合围栏 |
| `apps/web/app/ask-panel.tsx` | 文本 delta 按帧合并；结构化模式保持原表格 |
| `apps/web/app/globals.css` | 列表、代码块、表格和链接的紧凑样式及横向滚动 |
| `apps/web/package.json`、`pnpm-lock.yaml` | 增加 Markdown 解析依赖 |

**不完整代码围栏降级为纯文本。** 摘自 `markdown-reply.tsx`：

```tsx
// 代码围栏尚未闭合时展示原文，避免生成中反复改变代码块结构。
if (streaming && content.split("```").length % 2 === 0) {
  return <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{content}</pre>;
}
return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
  img: () => null,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
}}>{content}</ReactMarkdown>;
```

**优化前的基线代码：每次收到文本快照就更新。** `readStreamReply` 负责把所有 delta 拼成完整快照：

```tsx
(content) => {
  if (!controller.signal.aborted) updateExchange(id, { status: "streaming", content });
};
```

**当前代码只看三步：保存全文、预约一帧、处理终态。** 摘自 `ask-panel.tsx`，省略与此无关的请求代码：

```tsx
(content) => {
  // 一帧内只安排一次页面更新，后续 delta 覆盖待提交的完整快照。
  if (controller.signal.aborted) return;
  pendingContent = content;
  if (frame === undefined) frame = requestAnimationFrame(flush);
};
```

`flush` 把 `pendingContent` 写到页面并清掉 `frame`。正常 `done` 用协议给出的完整正文直接完成，停止和异常结束先 `flush()` 保留片段；`finally` 取消仍待执行的帧。结构化 `partial` 不经过这段文本合并。

## 一、通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | Markdown 文本与 Day 08 结构化对象分开；未闭合语法降级，Day 10 才做受控图表组件。 |
| 工具参数与自我纠错 | Markdown 中的命令或链接只是内容，不触发工具执行。 |
| 上下文与 Token | 渲染优化不减少模型 token；长文本仍受服务端 1024 token 与 4000 字符限制。 |
| HITL 与副作用安全 | 富文本回复不能当审批指令；当前无业务写入。 |
| 取消、断流与恢复 | 停止/失败保留片段，但不标完成；未闭合围栏继续按原文显示。 |

## 5. 本课专项五大深水坑

| 场景 | 风险 | 处理和证据 |
| --- | --- | --- |
| 原始 HTML / 脚本 | 模型内容执行不可信代码 | `skipHtml`；静态渲染检查无 `<script>` |
| `javascript:` 链接和图片 | 点击执行或加载追踪资源 | react-markdown 默认 URL 策略，图片不渲染；静态检查通过 |
| 未闭合代码围栏 | 生成中布局反复切换 | 先显示原文；静态渲染检查返回 `<pre>` |
| 高频小 delta | 可能反复解析越来越长的全文 | 已加入按帧合并；学习者未感到明显卡顿，实际收益待 Profiler 验证 |
| Markdown 表格/长代码溢出 | 手机页面横向撑开 | 表格与代码容器横向滚动；视觉待手动验收 |

## 6. 实际测试与验收

本轮运行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`、`git diff --check`，均 exit 0；已有 API 15/15、Web 6/6 测试通过，但不覆盖 Markdown。用 React 服务端静态渲染直接检查组件：GFM 表格有 `<table>` 和单元格；原始 `<script>`、图片及 `javascript:` URL 不进入输出；未闭合围栏在 streaming 状态输出原文 `<pre>`，四项通过。首次无服务检查因 Node 未找到 Web 目录下的 tsx 失败，改用 API 已安装的 loader 后通过。没有启动项目、运行 build 或使用真实 DeepSeek 做新请求。

2026-10-28 基线调整后复查：`pnpm lint`、`pnpm -r typecheck`、`git diff --check` 均 exit 0；未重新运行测试、无服务渲染检查、浏览器或 build。上段测试结果属于调整前的版本，不代表基线版本已经完成运行时验收。

2026-10-28 按帧合并加入后：`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test` 和 `git diff --check` 均 exit 0；现有 API 15/15、Web 6/6 测试通过，但不覆盖浏览器帧调度。未启动项目、未运行 build，也未运行浏览器对照测量，不能宣称性能改善。

- [x] GFM 表格、HTML 禁用、危险链接禁用、未闭合围栏降级通过无服务渲染检查。
- [x] lint、类型检查、现有测试及差异检查通过。
- [ ] 浏览器中长回答/表格/代码块的手机与桌面布局待验。
- [x] 学习者已体验逐次更新的真实 DeepSeek 基线，未观察到明显卡顿。
- [x] 按学习者要求加入 `requestAnimationFrame` 按帧合并；处理完成、停止与异常终态。
- [ ] 用 React Profiler 对照记录提交次数和耗时；当前没有性能收益结论。

在已有运行环境切“文本问答”，输入“请用 Markdown 给出三条排查步骤、一个 TypeScript 代码块和一张两列表格”。观察生成中的未闭合代码块、结束后的列表/代码/表格、手机宽度的横向滚动；Network 中确认是 `delta...done`。再切“结构化分析”，确认固定三列表格仍按 `partial...analysis_done` 工作。生成大型内容可能触及输出上限而失败，不把失败当 Markdown 渲染错误。

## 7. 排查

看到原样 Markdown：检查代码围栏是否还未闭合、当前是否仍在 streaming。表格未出现：确认表头与分隔线符合 GFM 语法。链接失效：检查是否被安全 URL 策略拒绝。流已结束仍缺字：核对最终 `done` 的 `reply.content` 是否覆盖待刷新的帧。

## 三、模拟面试真实考场

### Q1：流式 Markdown 为什么会出现布局跳动？

**回答：** 模型逐段给文本，未闭合的代码围栏、链接和表格暂时不构成稳定语法树。每个 delta 重解析时，节点可能从普通段落变成代码块。本课未闭合围栏先显示原文，闭合后再渲染；实际视觉效果仍需浏览器验收。**追问：为什么不把每个 chunk 当 Markdown 节点？** chunk 是任意字节边界，不等于语法边界。**错误答案：**“每个 token 都是完整 Markdown”。

### Q2：模型输出 Markdown，有哪些安全边界？

**回答：** 模型文本不可信；不解析执行原始 HTML/JSX，链接要限制危险协议，图片可禁用以免加载外部资源。使用成熟解析器并保持 React 的文本转义；结构化业务动作还须另行鉴权。**追问：`target=_blank` 需要什么？** `rel="noopener noreferrer"`。**错误答案：**“Markdown 天然安全，可以直接用 `dangerouslySetInnerHTML`”。

### Q3：如何证明流式渲染优化有效且不丢字？

**回答：** 先用每个 delta 更新状态的基线版本，记录 SSE 事件数、React Profiler 提交次数和耗时，并核对最终正文；确认高频提交是瓶颈后再试按帧合并，用相近回答复测。当前尚未取得浏览器测量数据。**追问：为什么不能只看感觉变流畅？** 网络、模型速度和浏览器调度都会影响主观感受。**错误答案：**“加了 `requestAnimationFrame` 就证明性能提高”。

## 9. 复盘与下一课

回答：1. 未闭合围栏为何先显示原文？2. 为什么每帧提交最新**全文**而不是最后一个 delta？3. Markdown 安全与 Day 10 的 UI Schema 有何不同？Git 建议只提交 Markdown 组件、样式、依赖锁文件、课件和进度；不提交密钥。Day 10 才接 ECharts 与受控组件注册表，本轮不提前实施。
