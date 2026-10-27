import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ConfigError, loadApiConfig, loadDeepSeekConfig } from "./config.js";
import { createDeepSeekProvider } from "./model-provider.js";

let app: ReturnType<typeof createApp> | undefined;

try {
  const localEnvPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);

  const config = loadApiConfig();
  if (!["127.0.0.1", "::1", "localhost"].includes(config.host)) {
    throw new ConfigError(["API_HOST"]);
  }
  const modelProvider = createDeepSeekProvider(loadDeepSeekConfig());
  app = createApp({ modelProvider });
  await app.listen(config);
} catch (error) {
  if (app) {
    app.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "API startup failed");
    await app.close();
  } else if (error instanceof ConfigError) {
    console.error(JSON.stringify({ code: "CONFIG_ERROR", fields: error.fields }));
  } else {
    console.error(JSON.stringify({ code: "STARTUP_ERROR", errorName: error instanceof Error ? error.name : "UnknownError" }));
  }
  process.exitCode = 1;
}
