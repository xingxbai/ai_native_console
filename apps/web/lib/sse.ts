import { streamEventSchema, type Analysis, type StreamEvent } from "@ai-native-console/contracts";

type Frame = { event: string; id: string; data: string };

export class SseParser {
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private line = "";
  private data: string[] = [];
  private event = "message";
  private id = "";
  private skipLf = false;

  feed(bytes: Uint8Array): Frame[] {
    return this.process(this.decoder.decode(bytes, { stream: true }));
  }

  finish(): void {
    this.process(this.decoder.decode());
    if (this.line || this.data.length || this.event !== "message" || this.id) {
      throw new Error("Incomplete SSE frame");
    }
  }

  private process(text: string): Frame[] {
    const frames: Frame[] = [];
    for (const char of text) {
      if (this.skipLf) {
        this.skipLf = false;
        if (char === "\n") continue;
      }
      if (char === "\r" || char === "\n") {
        this.processLine(frames);
        this.skipLf = char === "\r";
      } else {
        this.line += char;
        if (this.line.length > 16_384) throw new Error("SSE line is too long");
      }
    }
    return frames;
  }

  private processLine(frames: Frame[]): void {
    const line = this.line;
    this.line = "";
    if (!line) {
      if (this.data.length) frames.push({ event: this.event, id: this.id, data: this.data.join("\n") });
      this.data = [];
      this.event = "message";
      this.id = "";
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    const rawValue = colon < 0 ? "" : line.slice(colon + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "data") this.data.push(value);
    else if (field === "event") this.event = value;
    else if (field === "id" && !value.includes("\0")) this.id = value;
  }
}

export class StreamReplyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "StreamReplyError";
  }
}

export async function readStreamReply(
  response: Response,
  format: "text" | "analysis",
  onDelta: (content: string) => void,
  onPartial: (value: Partial<Analysis>) => void,
) {
  if (!response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new Error("Invalid stream response");
  }
  const requestId = response.headers.get("x-request-id");
  const parser = new SseParser();
  const reader = response.body.getReader();
  let start: Extract<StreamEvent, { type: "start" }> | undefined;
  let completed = false;
  let content = "";
  let analysis: Analysis | undefined;
  let sequence = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.feed(value)) {
        const event = streamEventSchema.parse(JSON.parse(frame.data));
        if (frame.event !== event.type || frame.id !== `${requestId}:${++sequence}`) {
          throw new Error("Invalid SSE event order");
        }
        if (event.type === "start") {
          if (start || event.requestId !== requestId || event.format !== format) {
            throw new Error("Invalid SSE start event");
          }
          start = event;
        } else if (!start || completed) {
          throw new Error("Unexpected SSE event");
        } else if (event.type === "delta") {
          if (format !== "text") throw new Error("Unexpected text event");
          content += event.text;
          if (content.length > 4_000) throw new Error("Stream reply is too long");
          onDelta(content);
        } else if (event.type === "partial") {
          if (format !== "analysis") throw new Error("Unexpected partial event");
          // 不完整字段只传给预览，不能作为最终可信对象。
          onPartial(event.value);
        } else if (event.type === "analysis_done") {
          if (format !== "analysis" || event.requestId !== requestId) throw new Error("Invalid analysis completion");
          analysis = event.value;
          completed = true;
        } else if (event.type === "error") {
          if (event.requestId !== requestId) throw new Error("Invalid SSE error event");
          throw new StreamReplyError(event.code, event.message);
        } else {
          if (format !== "text" || event.requestId !== requestId || !content.trim()) throw new Error("Invalid SSE completion");
          completed = true;
        }
      }
    }
    parser.finish();
    if (!completed || !start) throw new Error("Stream ended before completion");
    return { content, analysis, requestId: start.requestId, model: start.model };
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
