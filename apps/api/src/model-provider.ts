import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { z } from "zod";

const promptSchema = z.string().trim().min(1).max(500);
const configSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mock") }),
  z.object({
    kind: z.literal("deepseek"),
    apiKey: z.string().trim().min(1),
    model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).default("deepseek-v4-flash"),
  }),
]);

export type ModelProvider = {
  kind: "mock" | "deepseek";
  model: string;
  generate(prompt: string): Promise<string>;
};

export function createModelProvider(input: unknown): ModelProvider {
  const config = configSchema.parse(input);

  if (config.kind === "mock") {
    return {
      kind: "mock",
      model: "deterministic-mock",
      async generate(prompt) {
        return `Mock response: ${promptSchema.parse(prompt)}`;
      },
    };
  }

  const deepSeek = createDeepSeek({ apiKey: config.apiKey });

  return {
    kind: "deepseek",
    model: config.model,
    async generate(prompt) {
      const result = await generateText({
        model: deepSeek(config.model),
        prompt: promptSchema.parse(prompt),
        maxOutputTokens: 64,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(20_000),
      });
      return result.text;
    },
  };
}
