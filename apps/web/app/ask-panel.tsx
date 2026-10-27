"use client";

import { useState, type FormEvent } from "react";
import { apiErrorResponseSchema, chatResponseSchema, type ChatResponse } from "@ai-native-console/contracts";

type Result =
  | { status: "idle" | "loading" }
  | { status: "success"; data: ChatResponse }
  | { status: "error"; message: string; requestId?: string };

const errorMessages: Record<string, string> = {
  BAD_REQUEST: "请求格式不正确，请重试。",
  VALIDATION_ERROR: "问题不能为空，且不能超过 500 字。",
  MODEL_TIMEOUT: "回复超时，请稍后重试。",
  MODEL_UNAVAILABLE: "模型暂时不可用，请稍后重试。",
  MODEL_INVALID_RESPONSE: "回复格式异常，请稍后重试。",
  INTERNAL_ERROR: "服务暂时不可用，请稍后重试。",
  NOT_FOUND: "问答服务暂时不可用。",
};

const practicePrompts = [
  { category: "面试题", title: "Agent 与 Workflow", prompt: "面试题：什么场景用确定性 Workflow 就够了，什么场景才需要 Agent？请给一个工程例子，并说出两者的风险边界。" },
  { category: "面试题", title: "工具调用边界", prompt: "面试题：Tool Calling 到底是谁执行工具？模型返回合法 JSON 后，服务端还要检查什么？请结合权限和参数校验回答。" },
  { category: "面试题", title: "取消与超时", prompt: "面试题：浏览器调用 AbortController 后，能否保证 Node 服务端和模型请求已经停止？请说明还需要验证的环节。" },
  { category: "真实场景", title: "审批流程", prompt: "场景：运营人员想让 AI 批量修改订单状态。请设计执行前的服务端权限、参数校验和人工审批边界；不要假设已有订单数据。" },
  { category: "真实场景", title: "客服知识检索", prompt: "场景：客服助手需要依据产品文档回答退款规则。没有提供文档时，你会怎样设计检索、引用和拒答，避免编造政策？" },
  { category: "真实场景", title: "模型故障", prompt: "场景：生产请求遇到模型超时和 429。请给出用户可见状态、重试与成本上限的处理思路；不要假设当前项目已有这些能力。" },
] as const;

export function AskPanel() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = message.trim();
    if (!input || input.length > 500 || result.status === "loading") return;

    setResult({ status: "loading" });
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const apiError = apiErrorResponseSchema.safeParse(body);
        setResult({
          status: "error",
          message: apiError.success ? errorMessages[apiError.data.error.code] : "服务暂时不可用，请稍后重试。",
          requestId: apiError.success ? apiError.data.error.requestId : undefined,
        });
        return;
      }

      const parsed = chatResponseSchema.safeParse(body);
      setResult(parsed.success
        ? { status: "success", data: parsed.data }
        : { status: "error", message: "回复格式异常，请稍后重试。" });
    } catch {
      setResult({ status: "error", message: "连接失败，请稍后重试。" });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="question" className="block text-sm font-medium">问题</label>
        <textarea
          id="question"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={result.status === "loading"}
          maxLength={500}
          rows={3}
          placeholder="输入面试题或实际工程情境"
          className="w-full resize-y rounded-md border border-[#bdcbd0] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#207a74] focus:ring-2 focus:ring-[#d2eae5]"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#65747a]">{message.length}/500 · 每次提问单独计费</span>
          <button
            type="submit"
            disabled={!message.trim() || result.status === "loading"}
            className="min-w-20 rounded-md bg-[#173c42] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#aebbc0]"
          >
            {result.status === "loading" ? "正在回复" : "提问"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-5 min-h-8">
        {result.status === "success" && (
          <div className="border-t border-[#dbe2e5] pt-4">
            <p className="text-xs font-medium text-[#527c7e]">DeepSeek 回复</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{result.data.reply.content}</p>
            <p className="mt-3 break-all text-xs text-[#65747a]">请求 ID {result.data.requestId}</p>
          </div>
        )}
        {result.status === "error" && (
          <p className="break-words text-sm text-[#a04237]" role="alert">
            {result.message}{result.requestId ? ` 请求 ID ${result.requestId}` : ""}
          </p>
        )}
      </div>
      </div>
      <aside aria-label="练习题目" className="min-w-0 border-t border-[#dbe2e5] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <h3 className="mb-3 text-sm font-semibold">选题练习</h3>
        {(["面试题", "真实场景"] as const).map((category) => (
          <div key={category} className="mb-5">
            <p className="mb-2 text-xs font-medium text-[#527c7e]">{category}</p>
            <div className="divide-y divide-[#dbe2e5] border-y border-[#dbe2e5]">
              {practicePrompts.filter((item) => item.category === category).map((item) => (
                <button
                  key={item.title}
                  type="button"
                  disabled={result.status === "loading"}
                  onClick={() => { setMessage(item.prompt); setResult({ status: "idle" }); }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm hover:text-[#207a74] focus-visible:outline-2 focus-visible:outline-[#207a74] disabled:cursor-not-allowed disabled:opacity-50"
                  title={`填入${item.title}练习题`}
                >
                  <span>{item.title}</span><span aria-hidden="true" className="text-[#8b9a9e]">+</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
