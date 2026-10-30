# Day 10：Generative UI 安全组件注册表

日期：2026-10-28。状态：**IN_PROGRESS**。本课只接入真实 DeepSeek 的可视化数据输出和三种受控组件。按学习者要求，不启动项目、不运行 build、不新增或修改 `.test.ts`。

## 1. 目标与真实场景

在“可视化”模式提问：`请用柱状图展示我提供的示例数据：登录失败 12、支付失败 7、超时 4。` 模型选择组件类型并填写标题、标签、数值；前端决定组件实现和图表配置。这些数值来自问题本身，只是演示数据，不代表系统接入了真实业务库。

完成定义：模型只可选择 `kpi/table/bar`；完整数据经 Schema 校验后渲染；加载时占位高度稳定；未知组件、无效数值和空数组不会进入图表。

## 2. 主流程与重点代码

1. 用户选“可视化”并提问，服务端让 DeepSeek 返回一个 UI 数据对象。
2. 服务端用 `visualSchema` 校验最终对象，再通过 `visual_done` 发送。
3. 前端再校验一次，按 `type` 只渲染固定组件。

**约束模型输出**，见 `packages/contracts/src/index.ts`。以下为真实源码中的柱状图分支：

```ts
z.strictObject({ type: z.literal("bar"), title: z.string().trim().min(1).max(80), rows: z.array(z.strictObject({ label: z.string().trim().min(1).max(80), value: z.number().finite() })).min(1).max(8) })
```

完整 Schema 是 `kpi/table/bar` 的判别联合；文本长度、行数和数值都受限。

**最终校验后发事件**，见 `apps/api/src/app.ts`：

```ts
const value = await provider.streamVisual(VISUAL_INSTRUCTIONS, message, controller.signal);
if (!controller.signal.aborted) yield frame({ type: "visual_done", value, requestId });
```

**白名单渲染**，见 `apps/web/app/visual-reply.tsx`。以下是入口校验和 KPI 分支：

```tsx
const result = visualSchema.safeParse(value);
if (!result.success) return <p className="text-sm text-[#a04237]">可视化数据格式不正确。</p>;
const visual = result.data;
{visual.type === "kpi" && <div className="flex min-h-80 flex-col justify-center"><span className="text-sm text-[#65747a]">{visual.label}</span><strong className="text-3xl text-[#207a74]">{visual.value}</strong></div>}
```

源码中的 JSX 同时渲染标题和固定高度容器；图表 `option` 由应用根据验证后的标签和数值生成，模型不能直接提供 `option`。生成中只显示固定高度占位，表格超出时在容器内滚动；完整对象到达后再显示结果。本课没有把未完成的 partial 直接交给图表。

## 3. 通用五大深水坑

| 项目 | 本课位置 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | **本课重点**：`visual_done` 才可渲染；partial 仍属未完成数据。 |
| 工具参数与自我纠错 | **相关**：UI Schema 不是工具调用；错误输出显示失败，本课不做模型自纠错。 |
| 上下文与 Token | **相关**：最多 8 行，避免无限图表数据和输出截断。 |
| HITL 与副作用安全 | **暂不展开**：图表只展示数据，不能触发业务写入或审批。 |
| 取消、断流与恢复 | **相关**：停止或断流时没有 `visual_done`，不显示完成图表。 |

## 4. 本课专项五大深水坑

| 边界问题 | 处理 |
| --- | --- |
| 模型输出未知组件名 | 判别联合只允许 `kpi/table/bar`；前端再次校验。 |
| 模型给 ECharts 任意 `option` 或 HTML | Schema 无这些字段；图表配置由应用代码生成。 |
| 空数据、NaN、过多行 | `rows` 限 1–8，数值必须有限；校验失败显示错误。 |
| 加载时图表突然撑高页面 | 占位和图表都预留 `h-72`；手机、长标签仍待视觉检查。 |
| 模型编造业务指标 | 提示词禁止声称接入实时数据；界面没有业务数据工具，提问应提供示例数值。 |

## 5. 实际检查与验收

本课安装 `echarts` 成功。第一次安装因 registry DNS 和 pnpm store 配置失败；改用仓库原 registry 与现有 store 后成功。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`、`git diff --check` 均 exit 0；现有 API 15/15、Web 6/6 测试通过，但不覆盖新增可视化链路。无服务 Schema 检查：合法柱状图通过，未知组件、空数组和 `NaN` 均拒绝；第一次 `tsx -e` 因本机临时管道权限失败，改用 `node --import tsx --input-type=module` 后成功。**未启动项目、未运行 build、未调用真实 DeepSeek、未做浏览器视觉/布局偏移验收**。

手动验收：

1. 选择“可视化”，输入本课开头的三项示例数值，观察固定高度占位，再观察柱状图和标题；数值应与问题一致。
2. 分别要求“仅展示一个 KPI：本周新增 15”和“用表格展示 A 3、B 5”，确认三类组件均能出现。
3. 在窄屏查看长标签是否截断或溢出，停止生成时确认不会显示完整图表；Network 应看到 `start → visual_done` 或 `start → error`，不能把等待阶段当作完成。
4. 用浏览器 Performance 或 Layout Shift 指标对比占位和结果切换时的位置变化；本轮未取得测量值。

## 6. 模拟面试

**Q1：为什么不让模型直接输出 JSX 或 ECharts option？**
回答：模型输出不可信，也难以约束运行行为。让模型只提供有限的组件类型和数据，应用校验后用固定代码生成组件及 option。追问：只用 TypeScript 类型够吗？不够，网络数据仍要运行时 Schema 校验。错误答案：“模型按提示词输出就安全。”

**Q2：为什么等 `visual_done` 才渲染图表？**
回答：partial 可能缺标签、数值或数组项；把它当最终数据容易出现空白图、轴变化和布局跳动。本课先用固定高度占位，完整校验后再显示。追问：想渐进更新怎么办？定义每种组件的最小可用字段，并保留固定容器；仍不能把 partial 当作可信业务结果。错误答案：“每个 chunk 都可以直接 JSON.parse 后画图。”

**Q3：如何验证 Generative UI 没有布局偏移？**
回答：先给占位和真实组件相同的稳定高度，再在手机与桌面检查空数据、长标签和图例；用浏览器 Layout Shift 记录切换前后的位移。本课尚未运行浏览器测量。追问：高度固定就足够吗？不够，横向溢出和长标签也可能影响布局。错误答案：“截图看起来正常就证明没有偏移。”

## 7. 复盘与下一课

思考：1. 模型应该决定哪些字段，哪些必须由应用控制？2. 为什么完整 Schema 校验不能由 TypeScript 类型代替？3. 如果后续有真实订单数据，图表中的数字应该从哪里来？

Git 建议：只提交本课契约、模型分支、前端组件、依赖锁文件和课程记录，不提交密钥。Day 11 再学习 Tool Calling；本课没有读取订单或执行工具。
