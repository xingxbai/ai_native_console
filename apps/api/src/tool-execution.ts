import { setTimeout as delay } from "node:timers/promises";

export class ToolExecutionError extends Error {
  constructor(readonly code: "TOOL_TIMEOUT" | "TOOL_UNAVAILABLE") {
    super(code === "TOOL_TIMEOUT" ? "工具请求超时" : "工具服务不可用");
    this.name = "ToolExecutionError";
  }
}

export async function fetchReadOnlyJson(url: string, signal: AbortSignal): Promise<unknown> {
  // 只重试可重复读取的 GET；每次最多 5 秒，总共最多两次。
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = AbortSignal.timeout(5_000);
    try {
      const response = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) throw new ToolExecutionError("TOOL_UNAVAILABLE");
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof ToolExecutionError) throw error;
      if (attempt === 1) throw new ToolExecutionError(timeout.aborted ? "TOOL_TIMEOUT" : "TOOL_UNAVAILABLE");
    }
    if (attempt === 0) await delay(200, undefined, { signal });
  }
  throw new ToolExecutionError("TOOL_UNAVAILABLE");
}
