# Day 12：Zod 工具契约与描述设计

日期：2026-11-02。状态：**IN_PROGRESS**。前置：Day 11 的模型工具调用与演示订单数据。只推进本课；真实模型选择和浏览器验收尚待完成。

## 1. 目标与企业场景

在“工具问答”选择“请查询演示订单 124 的退款原因”。模型要决定调用 `getOrderDetail`，生成 `orderId: 124`；Node 校验参数，读取演示订单 JSON，返回该订单的事实，模型再回答。与固定字符串匹配的直出命令相比，这里要观察**模型如何填写有参数的工具调用**。

企业中订单查询会使用业务服务或数据库，并在执行前核对身份、租户与订单权限。本课只读本地演示数据；Schema 负责数据形状，Day 13 才建立授权入口。不要把本课工具用于真实订单接口。

## 2. 主流程与重点代码

`自然语言 → 模型选 getOrderDetail 并填写参数 → SDK 输入校验 → Node 执行边界再校验 → 业务模块读取订单 → 输出校验 → 模型回答 → SSE`。

**输入契约**在 `packages/contracts/src/index.ts`：

```ts
export const getOrderDetailInputSchema = z.strictObject({
  orderId: z.number().int().positive().max(999_999).describe("要查询的演示订单编号，例如 123"),
  view: z.enum(["status", "detail"]).optional().describe("只问状态时选 status；需要订单详情时选 detail，省略时返回详情"),
});
```

`orderId` 必填且必须是正整数；`view` 可省略，但给出时只能是 `status/detail`。`strictObject` 拒绝模型编造的额外字段。这里没有用默认值覆盖省略语义：业务模块明确把省略 `view` 解释为详情。

**输出契约**同文件：

```ts
export const getOrderDetailOutputSchema = z.strictObject({
  orderId: z.number().int().positive(), status: z.string(),
  customer: z.string().optional(), amount: z.number().nonnegative().optional(),
  refundReason: z.string().nullable().optional(),
});
```

`optional` 是字段可能不存在，例如只问状态时不返回 `customer`；`nullable` 是字段存在但值为 `null`，表示这笔演示订单没有填写退款原因。两者在业务语义上不同。

**执行边界**在 `apps/api/src/order-demo.ts`：

```ts
const { orderId, view } = getOrderDetailInputSchema.parse(input);
const { orders } = await readDemoOrders(signal);
const order = orders.find((item) => item.id === orderId);
if (!order) return { error: "演示订单不存在" };
return getOrderDetailOutputSchema.parse(view === "status"
  ? { orderId, status: order.status }
  : { orderId, status: order.status, customer: order.customer, amount: order.amount, refundReason: order.refundReason });
```

**模型工具描述**在 `apps/api/src/model-provider.ts`：

```ts
getOrderDetail: tool({
  description: "当用户询问某个演示订单的状态、客户、金额或退款原因时调用。必须提供订单编号；只问状态时 view 设为 status，否则可省略 view。仅查询本地演示数据，不适用于真实订单；查不到时明确说明不存在，不要编造。",
  inputSchema: getOrderDetailInputSchema,
  execute: async (input) => getOrderDetail(input, abortSignal),
}),
```

描述说明**何时用、要填什么、不能用于什么、找不到怎么办**。实际读取始终在 Node，不在浏览器，也不由模型自己执行。

## 3. 通用五大深水坑

| 深水坑 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 工具参数是完整对象，不能把部分参数当作可执行输入；页面仍只接收回答 SSE。 |
| 工具参数与自我纠错 | 本课校验一次并观察失败；有界自纠错留 Day 14。 |
| 上下文与 Token | 只返回一个订单的必要字段，不把 12 条演示订单全交给模型。 |
| HITL 与副作用安全 | 工具只读；Schema 通过不代表有权限，真实订单查询仍需服务端授权。 |
| 取消、断流与恢复 | `AbortSignal` 传到文件读取；未收到 `done` 不算完成，断线恢复未实现。 |

## 4. 本课专项五大深水坑

| 情形 | 处理与验收 |
| --- | --- |
| 参数名或类型幻觉 | `orderId` 必填且为正整数；字符串、缺字段和多余字段应拒绝。 |
| 工具异常导致 API 崩溃 | 现有 SSE 边界捕获异常并发 `error`；本课不新增重试，真实故障注入留 Day 15。 |
| 多工具选错 | 中文描述给出用途与不适用条件；需用实际 DeepSeek 问题验收选择，当前未验证。 |
| 工具放浏览器执行 | `execute` 在 Node 的模型适配层，浏览器仅接收 SSE 文本。 |
| Schema 合法误当授权合法 | `orderId:124` 只证明参数格式有效，不证明用户有权看订单 124；Day 13 补身份和权限入口。 |

## 5. 测试与手动验收

实际执行 `pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`、`git diff --check`，均 exit 0；现有 API 15/15、Web 6/6 测试通过，它们不覆盖新工具。无服务 Node 检查：`{orderId:124}` 与 `{orderId:124,view:"status"}` 通过；字符串编号、缺编号、非法枚举、0、1000000 和额外 `tenantId` 均拒绝。执行边界返回订单 124 的“待退款/商品瑕疵”，状态视图只返回编号和状态；订单 133 的 `refundReason` 为 `null`；订单 999 返回“不存在”。**没有启动项目、运行 build、调用真实 DeepSeek 或做浏览器验收。**

手动验收时选择“工具问答”并输入“请查询演示订单 124 的退款原因”：应回答“商品瑕疵”并说明为演示订单。再问“演示订单 133 的退款原因”：`refundReason` 为 `null`，应说明未填写，不能编造。问“演示订单 999 的状态”：应明确不存在。用服务端 trace 核对实际工具名与参数；当前尚无 trace 面板，浏览器 Network 只看到 `start/delta/done`，不能据页面文字断言模型真的调用了工具。

## 6. 模拟面试

**Q1：`optional` 和 `nullable` 在订单工具中有什么区别？** 参考回答：`view` 可省略，省略表示默认要详情；`refundReason` 可为 `null`，表示订单存在但未填写原因。追问：只问状态为何不返回退款原因？因为输出契约允许字段省略，减少无关数据。错误回答：“两者都表示没有值，所以一样。”

**Q2：`orderId` 通过 Zod 后能直接查真实订单吗？** 参考回答：不能。Zod 只验证参数形状和范围；真实查询还必须根据当前身份、租户和订单归属做授权。追问：授权应放在哪里？放在服务端业务执行入口，不能交给模型描述或浏览器判断。错误回答：“正整数就是合法订单请求。”

**Q3：如何判断模型选错了工具？** 参考回答：准备订单详情、退款周对比、普通概念题等问题，记录实际工具调用名、参数和结果，再核对预期；只看最终回答不能证明工具路径。追问：描述怎么降低误选？写明用途、输入和不适用条件，并通过样例回归验证。错误回答：“description 写长一点就不会错。”

## 7. 复盘与下一课

复盘：1. 为什么工具输入要在 SDK 和业务执行边界都校验？2. `null` 与字段缺失在用户回答中分别意味着什么？3. 如果换成真实订单系统，除了 Schema 还缺哪一步？

Git 建议只提交本课契约、订单查询工具、示例入口、课件和进度。Day 13 再处理工具注册与权限边界，本轮不提前实现。
