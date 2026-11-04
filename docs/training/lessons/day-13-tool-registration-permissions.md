# Day 13：工具注册、服务端执行与权限边界

日期：2026-11-02。状态：**IN_PROGRESS**。前置 Day 12 的参数契约。本课只实现受保护 AI 工具的注册表与演示范围检查，不实现登录或多步 Agent。

## 1. 目标与真实场景

主管问“演示员工 1024 在 2026 年 10 月迟到几次？”时，模型可提出工具调用，但 Node 必须核对该员工是否在主管可见范围。询问员工 2048 即使参数格式合法也应被拒绝。当前没有登录态；`demoActor` 是固定**演示身份**，无法识别真实浏览器用户，不可用于生产鉴权。

## 2. 主流程与重点代码

`用户问题 → 模型提出工具名/参数 → SDK 匹配工具 → Node 注册表检查名称 → Zod 校验参数 → Node 检查演示身份范围 → 业务函数读取 → 结果回模型 → SSE`。

见 `apps/api/src/tool-registry.ts`：

```ts
const args = getAttendanceDetailsInputSchema.parse(input);
if (actor.role !== "manager" || !actor.employeeIds.includes(args.employeeId)) {
  throw new ToolAccessError("FORBIDDEN");
}
return getAttendanceDetails(args, signal);
```

同文件统一拒绝未知名称：

```ts
if (!Object.hasOwn(toolHandlers, name)) throw new ToolAccessError("UNKNOWN_TOOL");
const handler = toolHandlers[name as keyof typeof toolHandlers];
return handler(input, actor, signal);
```

`model-provider.ts` 的 `execute` 只传模型生成的查询参数；`demoActor` 由 Node 端提供，模型不能传角色或授权列表。权限错误直接返回安全文案，不交给模型改写。业务读取仍在 `order-demo.ts`。

## 3. 通用五大深水坑

| 项目 | 本课处理 |
| --- | --- |
| 流式 / Partial JSON / Generative UI | 参数完整校验后才执行；前端不执行部分工具调用。 |
| 工具参数与自我纠错 | 权限拒绝不能自动重试；有界纠错留 Day 14。 |
| 上下文与 Token | 授权列表不写入 Prompt；模型只得到允许返回的最小结果。 |
| HITL 与副作用安全 | 本课只读，写操作需要审批和审计。 |
| 取消、断流与恢复 | `AbortSignal` 传给文件读取；无 `done` 不算完成。 |

## 4. 本课专项五大深水坑

| 情形 | 处理与检查 |
| --- | --- |
| 未知工具 | 注册表只允许自身显式注册的键；`unknown` 和原型名 `toString` 都返回 `UNKNOWN_TOOL`。 |
| 合法参数但越权 | 员工 2048 和订单 130 的编号合法，仍返回 `FORBIDDEN`。 |
| 模型伪造身份 | 工具参数没有角色/范围；身份由服务端传入。 |
| 只靠描述限制调用 | 描述不能阻止越权，执行边界必须再次检查。 |
| 固定演示身份被误当鉴权 | 当前所有请求共用 `demoActor`；真实项目必须接登录态、租户和数据归属，并统一覆盖其他查询入口。 |

## 5. 实际测试与手动验收

无服务执行检查：允许的订单 124 和员工 1024 返回数据；订单 130、员工 2048、只读角色访问订单 124 返回 `FORBIDDEN`；未知名称和对象原型名 `toString` 返回 `UNKNOWN_TOOL`。`pnpm lint`、`pnpm -r typecheck`、`pnpm -r test`（API 15/15、Web 6/6）、`git diff --check` 均 exit 0；现有测试不覆盖新增注册表。按要求不启动项目、不运行 build、不新增 `.test.ts`。

手动验收：在“工具问答”问员工 1024 的 2026-10 考勤，应得到 2 次迟到；问员工 2048 的同月考勤，若模型调用工具应收到无权查询，不能看到该员工记录。浏览器文字不能单独证明调用路径，服务端 trace 尚未建立；真实 DeepSeek 选择待验。当前 `direct-tools.ts` 的公开订单演示入口没有经过此受保护注册表，故本课不能声称所有入口已鉴权。

## 6. 模拟面试

**Q1：参数通过 Zod 后能查员工 2048 吗？** 回答：不能。Schema 只检查形状；Node 还需根据可信身份校验角色、租户和员工归属。演示身份只允许 1024。追问：把允许列表写进 Prompt 可以吗？不能，Prompt 不是授权边界。错误答案：“正整数就能查。”

**Q2：模型提出未知工具怎么办？** 回答：只执行注册表中显式定义的工具；未知名称拒绝，不按字符串动态加载函数。追问：前端传同名工具能执行吗？仍需同样的白名单和授权。错误答案：“让模型换个名称重试。”

**Q3：为什么 `demoActor` 不是企业鉴权？** 回答：它是全请求共享的固定对象，不能确认当前用户，也不能隔离租户。真实系统需从经验证的会话取得身份，并在每个数据入口执行授权。追问：只保护模型工具够吗？不够，直出和普通 API 也要统一检查。错误答案：“对象写在服务端就安全。”

## 7. 复盘与下一课

复盘：1. 模型参数与服务端身份分别来自哪里？2. 为什么参数合法仍可能越权？3. 直出入口绕过同一权限策略会有什么问题？

Git 建议提交注册表、模型工具接线、课件和进度。Day 14 才处理参数错误的有界纠错；本轮停在 Day 13。
