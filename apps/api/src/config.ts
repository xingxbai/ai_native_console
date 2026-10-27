import { z } from "zod";

const apiConfigSchema = z.object({
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.preprocess(
    (value) => value === undefined ? "3101" : value,
    z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65_535)),
  ),
});

export class ConfigError extends Error {
  constructor(readonly fields: string[]) {
    super(`Invalid API configuration: ${fields.join(", ")}`);
    this.name = "ConfigError";
  }
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env) {
  const result = apiConfigSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError([...new Set(result.error.issues.map((issue) => String(issue.path[0])))]);
  }
  return { host: result.data.API_HOST, port: result.data.API_PORT };
}

export function loadDeepSeekConfig(env: Record<string, string | undefined> = process.env) {
  const result = z.object({
    DEEPSEEK_API_KEY: z.string().trim().min(1),
    DEEPSEEK_MODEL: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).default("deepseek-v4-flash"),
  }).safeParse(env);
  if (!result.success) {
    throw new ConfigError([...new Set(result.error.issues.map((issue) => String(issue.path[0])))]);
  }
  return {
    apiKey: result.data.DEEPSEEK_API_KEY,
    model: result.data.DEEPSEEK_MODEL,
  };
}
