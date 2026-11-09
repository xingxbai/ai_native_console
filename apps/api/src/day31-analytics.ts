import { demoAnalyticsActor, getFailureBreakdown, getOperatorMetrics, getOrderMetrics } from "./business-analytics.js";

const signal = AbortSignal.timeout(5_000);
const query = { from: "2026-10-28", to: "2026-10-31" };
console.log("总体", JSON.stringify(await getOrderMetrics(query, demoAnalyticsActor, signal)));
console.log("运营商", JSON.stringify(await getOperatorMetrics(query, demoAnalyticsActor, signal)));
console.log("失败原因", JSON.stringify(await getFailureBreakdown(query, demoAnalyticsActor, signal)));
console.log("无数据", JSON.stringify(await getOrderMetrics({ from: "2026-11-02", to: "2026-11-03" }, demoAnalyticsActor, signal)));
try { await getOrderMetrics({ from: "2026-11-01", to: "2026-10-01" }, demoAnalyticsActor, signal); }
catch (error) { console.log("错误日期", error instanceof Error ? error.message : String(error)); }
try { await getOrderMetrics({ ...query, province: "广东" }, { tenantId: "demo-a", allowedProvinces: ["浙江"] }, signal); }
catch (error) { console.log("无权省份", error instanceof Error ? error.message : String(error)); }
