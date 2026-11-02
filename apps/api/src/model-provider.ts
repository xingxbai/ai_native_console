import { createDeepSeek } from "@ai-sdk/deepseek";
import { Output, stepCountIs, streamText, tool } from "ai";
import {
  analysisSchema,
  getOrderDetailInputSchema,
  partialAnalysisSchema,
  visualSchema,
  type Analysis,
  type Visual,
  getAttendanceDetailsInputSchema
 } from "@ai-native-console/contracts";
import { z } from "zod";
import { getDemoTaskStats, getDemoUserInfo } from "./demo-stats.js";
import { getOrderDetail, refundComparison, getAttendanceDetails } from "./order-demo.js";

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
  streamVisual(instructions: string, prompt: string, signal: AbortSignal): Promise<Visual>;
  streamToolReply(instructions: string, prompt: string, signal: AbortSignal): AsyncIterable<string>;
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

  async function streamVisual(instructions: string, prompt: string, signal: AbortSignal) {
    // 只接受三种固定组件的数据；完整对象通过 Schema 后才交给页面。
    const timeoutSignal = AbortSignal.timeout(20_000);
    const abortSignal = AbortSignal.any([signal, timeoutSignal]);
    try {
      const result = streamText({ ...requestOptions(instructions, prompt, abortSignal), output: Output.object({ schema: visualSchema }) });
      // partial 只用于等待生成结束，不把未校验数据送往浏览器。
      for await (const partial of result.partialOutputStream) { void partial; }
      if (await result.finishReason !== "stop") throw new ModelOutputLimitError();
      const visual = visualSchema.safeParse(await result.output);
      if (!visual.success) throw new ModelOutputLimitError();
      return visual.data;
    } catch (error) {
      if (timeoutSignal.aborted && !signal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  async function* streamToolReply(instructions: string, prompt: string, signal: AbortSignal) {
    // 外部 HTTP 加两轮模型调用可能超过普通问答的 20 秒，单独给工具模式 40 秒。
    const timeoutSignal = AbortSignal.timeout(40_000);
    const abortSignal = AbortSignal.any([signal, timeoutSignal]);
    try {
      const result = streamText({
        ...requestOptions(instructions, prompt, abortSignal),
        tools: {
          getDemoTaskStats: tool({
            description: "当用户询问演示用户 1 的任务完成统计时调用。读取 JSONPlaceholder 公共演示接口，只返回任务总数、已完成数和未完成数。数据仅用于演示，不是真实业务指标。",
            inputSchema: z.strictObject({}),
            // 模型只提出调用；Node 服务端实际请求公网示例接口。
            execute: async () => getDemoTaskStats(abortSignal),
          }),

          getDemoUserInfo: tool({
            description: "获取当前用户信息。返回用户的 id、name、username、email、phone、website 等字段。用于回答关于当前用户的个人信息问题。",
            inputSchema: z.strictObject({}),
            execute: async () => {
              return getDemoUserInfo(abortSignal);
            }
          }),
          getRefundComparison: tool({
            description: "当用户询问这周退款为什么变多、两周退款数量变化或本周退款原因时调用。返回固定日期演示订单的本周和上周退款笔数，以及本周原因分布。只可据此说明数量变化和本周分布，不能断言增长原因；缺少上周原因分布和订单总量。",
            inputSchema: z.strictObject({}),
            // 业务模块负责读数和统计；模型只接收汇总结果用于解释。
            execute: async () => refundComparison(abortSignal),
          }),
          getOrderDetail: tool({
            description: "当用户询问某个演示订单的状态、客户、金额或退款原因时调用。必须提供订单编号；只问状态时 view 设为 status，否则可省略 view。仅查询本地演示数据，不适用于真实订单；查不到时明确说明不存在，不要编造。",
            inputSchema: getOrderDetailInputSchema,
            execute: async (input) => getOrderDetail(input, abortSignal),
          }),
          getAttendanceDetails: tool({
            description: "当用户询问演示员工某个月的迟到或缺卡情况时调用。必须提供员工编号和月份，月份格式为 YYYY-MM；用户没说月份时先追问，不要猜测。只使用工具返回的该月记录；没有该月记录不能说员工不存在。",
            inputSchema: getAttendanceDetailsInputSchema,
            execute: async (input) => getAttendanceDetails(input, abortSignal),
          }),
        },
        // 最多一次工具调用，再让模型根据结果作答。
        stopWhen: stepCountIs(2),
        prepareStep: ({ stepNumber }) => stepNumber === 0 ? {} : { activeTools: [] },
      });
      let length = 0;
      for await (const part of result.fullStream) {
        if (part.type === "tool-error") {
          throw part.error;
        } else if (part.type === "error") {
          // SDK 将连接失败放进流事件；必须作为模型故障上报，不能误判成输出截断。
          throw part.error;
        } else if (part.type === "text-delta" && part.text) {
          length += part.text.length;
          if (length > 4_000) throw new ModelOutputLimitError();
          yield part.text;
        }
      }
      if (!length || await result.finishReason !== "stop") throw new ModelOutputLimitError();
    } catch (error) {
      if (timeoutSignal.aborted && !signal.aborted) throw new ModelTimeoutError();
      throw error;
    }
  }

  return {
    model,
    streamReply,
    streamAnalysis,
    streamVisual,
    streamToolReply,
  };
}
