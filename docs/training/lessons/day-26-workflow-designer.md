# Day 26：React Flow 工作流设计器

日期：2026-11-06。状态：**IN_PROGRESS（代码与静态检查完成，浏览器验收待做）**。前置：Day 21 图节点、Day 24 审批。本课只编辑草稿，不执行工作流、不发布、不调用 DeepSeek。

## 1. 真实场景与目标

运营人员要查看“查询订单 → 人工审批 → 结束”的流程，并在画布上调整顺序、名称和连线。React Flow 负责拖动、缩放、连线交互；服务端执行引擎以后才负责真正运行。把“画出来的流程”与“有权限执行的流程”分开。

## 2. 重点代码与操作

页面入口是 `apps/web/app/workflow/page.tsx`，编辑器在 `workflow-editor.tsx`。当前节点仅 `query`、`approval`、`end` 三种。初始流程是查询 → 审批 → 结束。关键交互：

```ts
const isValidConnection = useCallback((connection: Connection | Edge) => {
  const source = nodes.find((node) => node.id === connection.source);
  return Boolean(source && connection.target &&
    connection.source !== connection.target && source.data.stepType !== "end");
}, [nodes]);
```

上面只拒绝自连与从结束节点连出。编辑器允许添加节点、拖动节点、改名称、删除节点、画线、删除线、缩放和查看 JSON。当前 JSON 只抽取节点 ID/位置/类型/名称与边的起终点，不含 React Flow 的内部视图字段：

```ts
const workflow = {
  nodes: nodes.map(({ id, position, data }) => ({ id, position, type: data.stepType, label: data.label })),
  edges: edges.map(({ source, target }) => ({ source, target })),
};
```

这仍只是客户端内存草稿；刷新页面会重置。Day 27 才做图 Schema、环路、孤立节点、版本和发布前验证。手动打开 `/workflow`，首页顶部也有“工作流”入口。

## 3. 通用五大深水坑

| 深水坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 画布不是模型直接生成的 JSX；节点来自固定白名单。 |
| 工具参数与自我纠错 | 编辑器不会执行工具，JSON 也不能直接变成服务端调用。 |
| 上下文与 Token | 本课不调用模型；流程 JSON 仍可能随节点数增大。 |
| HITL 与副作用安全 | “人工审批”节点只是图形，不能证明审批人已批准。 |
| 取消、断流与恢复 | 画布草稿不等于 checkpoint、run 或 SSE 事件。 |

## 4. 本课专项五大深水坑

| 失效场景 | 本课处理或边界 | 验收 |
| --- | --- | --- |
| 把图形当可执行指令 | 只展示 JSON，不向 API 提交 | 页面没有运行/发布按钮。 |
| 任意节点类型 | 类型限定三种，颜色和 Handle 固定 | 添加菜单只能选三种。 |
| 无效连接 | 自连与结束节点作为来源被拒绝 | 拖动这两种连线应不能形成边。 |
| 长标签挤坏节点 | 固定节点宽度，名称允许换行，80 字上限 | 输入长名称检查节点布局。 |
| 手机画布操作困难 | 小屏画布固定高度，侧栏移到画布下方 | 手机宽度检查缩放、编辑和 JSON 不重叠。 |

## 5. 实际测试与验收

实际安装 `@xyflow/react` 并更新锁文件。`pnpm -r typecheck`、`pnpm lint`、`pnpm -r test` 均 exit 0；现有 API 15/15、Web 6/6 测试不覆盖新画布。未新增 `.test.ts`；按用户要求未启动项目、未运行 build，因此拖动、无效连接、长标签和手机布局**尚未在浏览器验证**。

手动验收：已有项目运行时访问 `/workflow`；拖动查询节点并观察 JSON 中位置；新增一个审批节点、改名、连线，再删除；尝试自连与从结束节点连线；输入 80 字长名称；切到手机宽度看画布、侧栏和 JSON。刷新后草稿重置是当前预期。

## 6. 模拟面试

**Q1：React Flow 与 LangGraph 各负责什么？** 推荐回答：React Flow 管浏览器中的节点和连线编辑；LangGraph 管服务端运行状态和节点执行。编辑器 JSON 必须通过服务端校验与映射才能执行。追问：画布上有审批节点就完成 HITL 了吗？没有，它只是配置视图。错误答案：“两者都是图，直接共用对象即可”。

**Q2：为什么不能直接执行浏览器导出的 JSON？** 推荐回答：用户可以修改请求，图可能有非法节点、环路、缺边或越权工具。服务端要按版本和白名单验证，发布后才交给执行引擎。追问：本课自连检查能防所有环吗？不能，跨多个节点仍能构成环。错误答案：“前端已经校验，后端不必再查”。

**Q3：如何保存和恢复一个工作流草稿？** 推荐回答：需要稳定的流程 ID、版本、节点/边 Schema 和存储接口；本课仅客户端内存，刷新丢失。追问：草稿版本与运行 checkpoint 一样吗？不同，前者是流程定义，后者是一次执行的状态。错误答案：“把 React Flow 全部内部状态直接存为生产协议”。

## 7. 复盘与下一课

1. 为什么工作流画布中的“人工审批”还不能替代 Day 25 的实际授权检查？
2. 目前前端挡住了哪两种非法连线，还有哪些坏图能画出来？
3. 为什么导出的 JSON 不能直接交给执行引擎？

Git 建议提交依赖、页面、课件及进度。Day 27 再做静态校验；本轮停在 Day 26。
