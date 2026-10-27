import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ConfigError, loadApiConfig } from "./config.js";

const app = createApp();

try {
  const localEnvPath = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);

  const config = loadApiConfig();
  await app.listen(config);
} catch (error) {
  if (error instanceof ConfigError) {
    app.log.error({ code: "CONFIG_ERROR", fields: error.fields }, "API configuration failed");
  } else {
    app.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "API startup failed");
  }
  process.exitCode = 1;
  await app.close();
}
