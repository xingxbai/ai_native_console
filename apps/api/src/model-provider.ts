import { createDeepSeek } from "@ai-sdk/deepseek";
import { Output, streamText } from "ai";
import { analysisSchema, partialAnalysisSchema, type Analysis } from "@ai-native-console/contracts";
import { z } from "zod";

const promptSchema = z.string().trim().min(1).max(500);
const instructionsSchema = z.string().trim().min(1).max(500);
const configSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).default("deepseek-v4-flash"),
});

export type ModelProvider = {
  model: string;
  streamReply(instructions: string, prompt: string, signal: AbortSignal): AsyncIterable<string>;
  streamAnalysis(instructions: string, prompt: string, signal: AbortSignal): AsyncIterable<{ type: "partial"; value: Partial<Analysis> } | { type: "final"; value: Analysis }>;
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

  async function* streamReply(instructions: string, prompt: string, signal: AbortSignal) {
    // 用户取消与模型超时共用一个终止信号，异常映射时再区分原因。
    const timeoutSignal = AbortSignal.timeout(20_000);
    const abortSignal = AbortSignal.any([signal, timeoutSignal]);
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
      if (timeoutSignal.aborted && !signal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  async function* streamAnalysis(instructions: string, prompt: string, signal: AbortSignal) {
    const timeoutSignal = AbortSignal.timeout(20_000);
    const abortSignal = AbortSignal.any([signal, timeoutSignal]);
    try {
      const result = streamText({
        ...requestOptions(instructions, prompt, abortSignal),
        output: Output.object({ schema: analysisSchema }),
      });
      // partialOutputStream 的对象仅供预览，最终结果仍必须完整校验。
      for await (const value of result.partialOutputStream) {
        const parsed = partialAnalysisSchema.safeParse(value);
        if (parsed.success && !signal.aborted) yield { type: "partial" as const, value: parsed.data };
      }
      if (signal.aborted) return;
      if (await result.finishReason !== "stop") throw new ModelOutputLimitError();
      const final = analysisSchema.safeParse(await result.output);
      if (!final.success) throw new ModelOutputLimitError();
      yield { type: "final" as const, value: final.data };
    } catch (error) {
      if (timeoutSignal.aborted && !signal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  return {
    model,
    streamReply,
    streamAnalysis,
  };
}
