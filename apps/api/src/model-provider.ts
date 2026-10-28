import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, streamText } from "ai";
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
  streamReply(instructions: string, prompt: string): AsyncIterable<string>;
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

  function requestOptions(instructions: string, prompt: string, abortSignal: AbortSignal) {
    return {
      model: deepSeek(model),
      instructions: instructionsSchema.parse(instructions),
      prompt: promptSchema.parse(prompt),
      providerOptions: { deepseek: { thinking: { type: "disabled" as const } } },
      maxOutputTokens: 1024,
      maxRetries: 0,
      abortSignal,
    };
  }

  async function generateReply(instructions: string, prompt: string) {
    const abortSignal = AbortSignal.timeout(20_000);
    try {
      const result = await generateText(requestOptions(instructions, prompt, abortSignal));
      if (result.finishReason === "length") throw new ModelOutputLimitError();
      return result.text;
    } catch (error) {
      if (abortSignal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  async function* streamReply(instructions: string, prompt: string) {
    const abortSignal = AbortSignal.timeout(20_000);
    try {
      const result = streamText(requestOptions(instructions, prompt, abortSignal));
      let length = 0;
      for await (const text of result.textStream) {
        length += text.length;
        if (length > 4_000) throw new ModelOutputLimitError();
        if (text) yield text;
      }
      if (!length || await result.finishReason !== "stop") throw new ModelOutputLimitError();
    } catch (error) {
      if (abortSignal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  return {
    model,
    generateReply,
    streamReply,
  };
}
