import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDeepSeekConfig } from "./config.js";
import { createOrderAgentGraphDemo } from "./order-agent-graph.js";

// 课程命令直接读取已有本地密钥文件，不启动 HTTP 服务，也不输出密钥。
const localEnv = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

try {
  const question = process.argv.slice(2).join(" ");
  const run = createOrderAgentGraphDemo(loadDeepSeekConfig(), AbortSignal.timeout(40_000));
  console.log(2222, JSON.stringify(await run({ question }), null, 2));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : "图执行失败");
  process.exitCode = 1;
}
