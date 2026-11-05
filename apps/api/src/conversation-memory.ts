import type { ChatRequest } from "@ai-native-console/contracts";

type Turn = NonNullable<ChatRequest["history"]>[number];

export function selectHistory(history: Turn[], budget = 400) {
  const recent: Turn[] = [];
  let used = 0;
  for (const turn of [...history].reverse()) {
    // 与 Day 17 一样只做字符粗估；近期对话按完整问答对保留。
    const cost = Math.ceil(Array.from(turn.question).length / 2) + Math.ceil(Array.from(turn.answer).length / 2);
    if (recent.length >= 4 || used + cost > budget) break;
    recent.unshift(turn);
    used += cost;
  }
  // 从整对消息边界裁剪，绝不只保留问题或只保留回答。
  return { recent, older: history.slice(0, history.length - recent.length) };
}
