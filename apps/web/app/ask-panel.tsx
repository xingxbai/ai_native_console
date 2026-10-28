"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiErrorResponseSchema, type Analysis } from "@ai-native-console/contracts";
import { readStreamReply, StreamReplyError } from "../lib/sse";
import { MarkdownReply } from "./markdown-reply";

type Mode = "text" | "analysis";
type Exchange = { id: number; question: string; mode: Mode; status: "loading" | "streaming" | "complete" | "cancelled" | "error"; content: string; partial?: Partial<Analysis>; analysis?: Analysis; error?: string; requestId?: string };

const errorMessages: Record<string, string> = {
  BAD_REQUEST: "请求格式不正确，请重试。",
  VALIDATION_ERROR: "问题不能为空，且不能超过 500 字。",
  MODEL_TIMEOUT: "回复超时，请稍后重试。",
  MODEL_UNAVAILABLE: "模型暂时不可用，请稍后重试。",
  MODEL_INVALID_RESPONSE: "回复格式异常，请稍后重试。",
  INTERNAL_ERROR: "服务暂时不可用，请稍后重试。",
  NOT_FOUND: "问答服务暂时不可用。",
};

export function AskPanel() {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const activeRequest = useRef<{ id: number; controller: AbortController; flush: () => void } | null>(null);

  // 用户查看旧记录时暂停自动跟随，新问题提交后恢复跟随。
  useEffect(() => {
    if (followRef.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [exchanges]);

  useEffect(() => () => {
     return activeRequest.current?.controller.abort();
  }, []);

  function updateExchange(id: number, patch: Partial<Exchange>) {
    setExchanges((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = message.trim();
    if (!input || input.length > 500 || busy) return;

    const id = ++nextId.current;
    const controller = new AbortController();
    let pendingContent: string | undefined;
    let frame: number | undefined;
    const flush = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      // 停止或失败时保留尚未绘制的最后一段。
      if (pendingContent !== undefined && !controller.signal.aborted)
        updateExchange(id, { status: "streaming", content: pendingContent });
      pendingContent = undefined;
    };
    activeRequest.current = { id, controller, flush };
    followRef.current = true;
    setBusy(true);
    setMessage("");
    setExchanges((items) => [...items, { id, question: input, mode, status: "loading", content: "" }]);
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input, format: mode }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const body: unknown = await response.json();
        const apiError = apiErrorResponseSchema.safeParse(body);
        updateExchange(id, {
          status: "error",
          error: apiError.success ? errorMessages[apiError.data.error.code] : "服务暂时不可用，请稍后重试。",
          requestId: apiError.success ? apiError.data.error.requestId : undefined,
        });
        return;
      }

      // 只有流协议收到 done 后才将这条回复标记为完成。
      const reply = await readStreamReply(
        response,
        mode,
        (content) => {
          // 一帧内只安排一次页面更新，后续 delta 覆盖待提交的完整快照。
          if (controller.signal.aborted) return;
          pendingContent = content;
          if (frame === undefined) frame = requestAnimationFrame(flush);
        },
        (partial) => { if (!controller.signal.aborted) updateExchange(id, { status: "streaming", partial }); },
      );
      if (!controller.signal.aborted) {
        // done 自带完整正文，直接取消待绘制帧即可。
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
        updateExchange(id, { status: "complete", content: reply.content, analysis: reply.analysis, requestId: reply.requestId });
      }
    } catch (error) {
      if (!controller.signal.aborted) flush();
      if (!controller.signal.aborted) updateExchange(id, {
        status: "error",
        error: error instanceof StreamReplyError
          ? errorMessages[error.code] ?? "流式回复未完成，请重试。"
          : "回复中断或格式异常，请重试。",
      });
    } finally {
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (activeRequest.current?.id === id) activeRequest.current = null;
      setBusy(false);
    }
  }

  function stop() {
    const active = activeRequest.current;
    if (!active) return;
    // 先锁定界面终态，再中断请求，避免迟到的 delta 覆盖“已停止”。
    active.flush();
    updateExchange(active.id, { status: "cancelled" });
    active.controller.abort();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
      <div aria-label="回答类型" className="mb-5 inline-flex rounded-md border border-[#bdcbd0] bg-white p-0.5">
        {([{"value":"text","label":"文本问答"},{"value":"analysis","label":"结构化分析"}] as const).map((option) => (
          <button key={option.value} type="button" aria-pressed={mode === option.value} disabled={busy}
            onClick={() => setMode(option.value)}
            className={`min-w-28 rounded px-3 py-1.5 text-sm disabled:cursor-not-allowed ${mode === option.value ? "bg-[#173c42] text-white" : "text-[#52646b] hover:text-[#173c42]"}`}>
            {option.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="question" className="block text-sm font-medium">问题</label>
        <textarea
          id="question"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={busy}
          maxLength={500}
          rows={3}
          placeholder="输入面试题或实际工程情境"
          className="w-full resize-y rounded-md border border-[#bdcbd0] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#207a74] focus:ring-2 focus:ring-[#d2eae5]"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#65747a]">{message.length}/500 · 每次提问单独计费</span>
          <button
            type="submit"
            disabled={!message.trim() || busy}
            className="min-w-20 rounded-md bg-[#173c42] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#aebbc0]"
          >
            {busy ? "正在回复" : "提问"}
          </button>
          {busy && <button type="button" onClick={stop} className="rounded-md border border-[#bdcbd0] px-4 py-2 text-sm font-medium" title="停止生成">停止</button>}
        </div>
      </form>

      <div ref={listRef} aria-label="提问记录" onScroll={(event) => {
        const element = event.currentTarget;
        followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }} className="mt-5 max-h-[32rem] min-h-8 overflow-y-auto" role="log" aria-live="polite">
        {exchanges.map((item) => (
          <div key={item.id} className="border-t border-[#dbe2e5] py-4">
            <p className="text-xs font-medium text-[#65747a]">问题</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{item.question}</p>
            <p className="mt-3 text-xs font-medium text-[#527c7e]">DeepSeek · {item.mode === "analysis" ? "结构化分析 · " : ""}{{ loading: "等待回复", streaming: "正在回复", complete: "已完成", cancelled: "已停止", error: "回复失败" }[item.status]}</p>
            {item.content && <MarkdownReply content={item.content} streaming={item.status === "streaming"} />}
            {item.mode === "analysis" && (item.partial || item.analysis) && (
              <div className="mt-2 space-y-2 text-sm leading-6">
                {([{"key":"summary","label":"摘要"},{"key":"risk","label":"风险"},{"key":"action","label":"下一步"}] as const).map(({ key, label }) => (
                  <p key={key} className="break-words"><span className="font-medium">{label}：</span>{(item.analysis ?? item.partial)?.[key] ?? "生成中"}</p>
                ))}
                <p className="text-xs text-[#65747a]">{item.analysis ? "最终对象已校验" : "部分字段仅供预览"}</p>
              </div>
            )}
            {item.error && <p className="mt-2 text-sm text-[#a04237]" role="alert">{item.error}</p>}
            {item.requestId && <p className="mt-3 break-all text-xs text-[#65747a]">请求 ID {item.requestId}</p>}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
