import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { z } from "zod";

const promptSchema = z.string().trim().min(1).max(500);
const instructionsSchema = z.string().trim().min(1).max(500);
const configSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).default("deepseek-v4-flash"),
});

export type ModelProvider = {
  model: string;
  generateReply(instructions: string, prompt: string): Promise<string>;
};

export class ModelTimeoutError extends Error {
  constructor() {
    super("Model request timed out");
    this.name = "ModelTimeoutError";
  }
}

export class ModelOutputLimitError extends Error {
  constructor() {
    super("Model output reached the token limit");
    this.name = "ModelOutputLimitError";
  }
}

export function createDeepSeekProvider(input: unknown): ModelProvider {
  const config = configSchema.parse(input);
  const deepSeek = createDeepSeek({ apiKey: config.apiKey });
  const model = config.model;

  async function generateReply(instructions: string, prompt: string) {
    const abortSignal = AbortSignal.timeout(20_000);
    try {
      const result = await generateText({
        model: deepSeek(model),
        instructions: instructionsSchema.parse(instructions),
        prompt: promptSchema.parse(prompt),
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
        maxOutputTokens: 1024,
        maxRetries: 0,
        abortSignal,
      });
      if (result.finishReason === "length") throw new ModelOutputLimitError();
      return result.text;
    } catch (error) {
      if (abortSignal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  return {
    model,
    generateReply,
  };
}
