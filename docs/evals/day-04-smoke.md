# Day 04 最小问答评测样例

更新日期：2026-10-27。当前实现只使用 DeepSeek。此文件记录**实际观察**，不是模型质量基准或生产可用性报告。每次提问独立处理，没有会话记忆；请求中没有包含密钥。此前的模拟模式记录保留在历史 Day 04 课件中，不属于当前验收。

| ID | 输入/场景 | 预期检查 | 实际观察 | 结论 |
| --- | --- | --- | --- | --- |
| E01 | `Reply with exactly the word OK.` | 同源入口 200，`assistant` 非空、`provider=deepseek`，内容为 `OK`。 | `deepseek-v4-flash` 返回 200、`OK`，响应头和 JSON 的 requestId 一致。 | 通过；只是一个短答样本。 |
| E02 | `What is 2 + 2? Reply with only the number.` | 同源入口 200，内容为 `4`，来源 DeepSeek。 | `deepseek-v4-flash` 返回 200、`4`，请求 ID 有效。 | 通过；不能外推复杂推理能力。 |
| E03 | 空白问题：`"   "` | 发模型请求前拒绝，HTTP 400。 | Fastify 与 Next 入口均返回 400、`VALIDATION_ERROR`，错误体与响应头 ID 一致。 | 输入边界通过。 |

故障适配器的运行时注入结果：超时返回 504/`MODEL_TIMEOUT`，一般异常返回 503/`MODEL_UNAVAILABLE`，空输出返回 502/`MODEL_INVALID_RESPONSE`；三者均保持头体 ID 一致，内部异常文本未进入响应。该注入不等于真实 DeepSeek 的 429、401、断网或 20 秒超时测试。

## 本轮题目练习观察（2026-10-27）

| 场景 | 实际观察 | 结论 |
| --- | --- | --- |
| Agent 与 Workflow 面试题，原 128 token 配置 | 同源入口 502/`MODEL_INVALID_RESPONSE`；独立诊断确认默认思考模式下 512 token 全用于 reasoning，正文为空。 | 旧配置不适合实际练习，失败记录保留。 |
| 关闭思考模式、256/512 token 诊断 | 生成正文但 `finishReason=length`，512 token 的同源回复曾以 200 返回半截表格。 | 截断内容不能标记为完整回答。 |
| 关闭思考模式、简短回答指令、1024 token 与截断拒绝 | 同源面试题和“订单状态审批”场景题均为 200，`provider=deepseek`，返回非空完整正文；空白题为 400。 | 当前题目练习路径可用，仍需人工核查内容与边界。 |

上述记录是少量功能样例和一次故障定位，不计算准确率、平均延迟或 SLA。故障注入 **3** 种记录来自改造前，不等于真实供应商 401/429/超时测试。Day 34 才建立固定 Golden Dataset 与可比较指标。
