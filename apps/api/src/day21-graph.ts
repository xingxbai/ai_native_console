import { runOrderRoute } from "./order-route-graph.js";

// 独立课程练习入口：只运行本地图，不启动 HTTP 服务或请求 DeepSeek。
const [, , orderId, intent] = process.argv;
try {
  const result = await runOrderRoute({ orderId: Number(orderId), intent });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : "图执行失败");
  process.exitCode = 1;
}
