import { readKnowledgeSource, searchKnowledge, type KnowledgeActor } from "./knowledge-search.js";

export async function answerFromKnowledge(query: string, actor: KnowledgeActor, signal: AbortSignal) {
  const source = await readKnowledgeSource(signal);
  const { results } = searchKnowledge(source, { query }, actor);
  if (!results.length) return { answer: "未找到当前可访问且有效的手册依据，无法回答。", citations: [] };

  // 只返回检索片段原文，避免生成文字超出证据；每条引用都能回查到有效版本。
  const citations = results.map(({ sourceId, documentId, version, sectionId, title, heading, content }) => ({
    sourceId, documentId, version, sectionId, title, heading, quote: content,
  }));
  return { answer: citations.map((item) => `${item.quote} [${item.sourceId}]`).join("\n"), citations };
}
