import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createModelProvider } from "./model-provider.js";

const localEnvPath = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const key = process.env.DEEPSEEK_API_KEY;

try {
  const provider = createModelProvider({ kind: "deepseek", apiKey: key, model });
  const startedAt = Date.now();
  const text = await provider.generate("Reply with exactly one word: OK.");

  console.log(JSON.stringify({
    provider: provider.kind,
    model: provider.model,
    status: text.trim() ? "ok" : "empty_response",
    text: text.slice(0, 120),
    elapsedMs: Date.now() - startedAt,
  }));

  if (!text.trim()) process.exitCode = 1;
} catch (error) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? error.statusCode
    : undefined;
  console.error(JSON.stringify({ status: "failed", error: name, statusCode }));
  process.exitCode = 1;
}
