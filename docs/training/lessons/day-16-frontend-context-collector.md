# Day 16：前端 ContextCollector

日期：2026-11-04。状态：**IN_PROGRESS**。前置：Day 02 请求契约、Day 11 工具调用。本课只做首页演示订单的页面上下文，不做会话记忆或 Token 裁剪。

## 1. 场景与目标

运营选中订单 123 后问“这条订单现在什么状态？”。模型只有问题文本时不知道“这条”指谁。前端从显式页面状态收集路由、选中订单 ID 和筛选条件，服务端重新校验后把 ID 作为工具定位线索。模型仍须调用工具查真实数据；页面选择不是权限证明。

流程：`筛选状态 → 选择订单 → 提问 → 白名单采集 → Web/API 校验 → DeepSeek 选工具 → 服务端查询 → SSE 回答`。筛选条件用于缩小页面可选项，本课模型实际只使用选中订单 ID。

## 2. 重点代码

`apps/web/lib/context-collector.ts` 只选择三个字段，不读取 DOM、输入框、客户姓名或手机号：

```ts
const context = {
  route: state.route,
  selectedOrderId: state.selectedOrderId || undefined,
  statusFilter: state.statusFilter,
};
return chatRequestSchema.shape.context.unwrap().parse(context);
```

`packages/contracts/src/index.ts` 用严格对象、固定路由、三个演示订单 ID 和四个筛选值限定传输。`ask-panel.tsx` 在提交瞬间采集当前状态；改变筛选器时清空旧选择。Next 代理和 Fastify 都重新校验请求。API 只在工具模式使用选中 ID：

```ts
const toolInstructions = input.data.context?.selectedOrderId
  ? `${TOOL_INSTRUCTIONS} 当前页面选中演示订单 ${input.data.context.selectedOrderId}；若用户说“这条订单”，先用工具查询该编号。`
  : TOOL_INSTRUCTIONS;
```

## 3. 通用五大深水坑

| 深水坑 | 本课关系 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 相关：上下文在请求开始时固定；流式展示不能修改本次请求。 |
| 工具参数与自我纠错 | 相关：模型可用选中 ID 生成参数；服务端仍校验参数和权限。 |
| 上下文与 Token | 本课重点：只传三个白名单字段；预算留给 Day 17。 |
| HITL 与副作用安全 | 暂不展开：选中订单不等于审批或授权。 |
| 取消、断流与恢复 | 相关：停止后下一次提交重新采集最新选择。 |

## 4. 本课专项五大深水坑

| 风险 | 触发、表现与原因 | 处理和验收 |
| --- | --- | --- |
| 发送整个 DOM | 页面含隐藏字段或敏感表单，导致泄露和上下文膨胀 | 只取显式状态；检查请求体无 DOM/客户信息。 |
| 额外敏感字段 | 客户端附加手机号，服务端误信 | 严格 Schema 拒绝；无服务契约操作已通过。 |
| 切换后旧订单残留 | 筛选从已退款切到待退款，仍指向 123 | 筛选变化清空选择；手动查看下一次请求体。 |
| 页面状态冒充事实 | 页面写“已退款”，模型不查工具直接回答 | 指令要求查工具；真实模型调用轨迹待验。 |
| 页面状态冒充权限 | 伪造 ID 查询别人的订单 | Schema 限演示 ID，工具仍独立鉴权；真实登录态尚未实现。 |

## 5. 实测与验收

`node --experimental-strip-types --input-type=module -e ...` 实际执行：合法 123 和切换后的 124 通过，额外 `customerPhone` 与 `/admin` 路由被拒绝，exit 0；Node 22 提示类型剥离仍为实验性功能。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）和 `git diff --check` 均 exit 0。现有测试没有覆盖新页面交互。没有新增 `.test.ts`，没有启动项目、运行 build 或调用 DeepSeek。

手动验收：选“已退款 → 123”，切到“工具问答”，问“这条订单现在是什么状态？”。Network 请求体应含 `context: {route:"/",selectedOrderId:"123",statusFilter:"refunded"}`，且不含手机号或 DOM。切到“待退款”应先清空选择；再选 124 提问，请求和回答应指向 124。无选择时不应猜测订单号。

## 6. 模拟面试

**Q1：为什么只传订单 ID，不传整个 DOM？** 推荐回答：任务只需定位订单；DOM 有无关信息、隐藏字段和潜在个人信息，还增加 Token 与注入风险。追问：客户姓名可见就能发吗？回答：默认不发，只有任务需要且有权限和契约时才加。错误答案：“可见 DOM 都安全”，忽略隐藏字段和第三方内容。

**Q2：前端已经校验，API 为什么还校验？** 推荐回答：浏览器请求可伪造；Web 代理和 Fastify 都按共享契约校验，工具层另做权限判断。追问：Schema 通过等于有权查 123 吗？回答：不等于，只说明数据格式和值符合演示契约。错误答案：“TypeScript 类型能挡伪造”，类型只在编译期有效。

**Q3：切换订单如何避免旧上下文？** 推荐回答：筛选改变立即清空旧选择，每次提交重新采集当前页面状态；已经发出的请求持有当时快照。追问：真实浏览器切换验收过吗？回答：本课还没有，无服务检查只证明两组上下文合法。错误答案：“让模型记住当前行”，模型没有可靠的实时页面状态。

## 7. 复盘

1. “这条订单”查询真正需要哪些页面字段？
2. 用户伪造选中 ID 时，哪一层负责拒绝越权？
3. 为什么筛选变化要清空旧选中项？

Git 建议只提交上下文契约、采集器、页面选择、API 指令及本课文档。下一课 Day 17 才做 Token 预算；本轮停在 Day 16。
