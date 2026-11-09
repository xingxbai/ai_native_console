import { readFile } from "node:fs/promises";
import MiniSearch from "minisearch";
import { z } from "zod";

const sectionSchema = z.strictObject({ id: z.string(), heading: z.string(), content: z.string() });
const documentSchema = z.strictObject({
  id: z.string(), title: z.string(), tenantId: z.string(), roles: z.array(z.enum(["support", "manager"])),
  versions: z.array(z.strictObject({ version: z.number().int().positive(), active: z.boolean(), sections: z.array(sectionSchema) })),
});
const sourceSchema = z.strictObject({ documents: z.array(documentSchema) });
const querySchema = z.strictObject({ query: z.string().trim().min(2).max(100) });
export const knowledgeQuerySchema = querySchema;
export type KnowledgeActor = { tenantId: string; role: "support" | "manager" };
export const demoKnowledgeActor: KnowledgeActor = { tenantId: "demo-a", role: "support" };
type Source = z.infer<typeof sourceSchema>;

const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const tokenize = (text: string) => [...segmenter.segment(text)].filter((part) => part.isWordLike).map((part) => part.segment.toLowerCase());

export async function readKnowledgeSource(signal: AbortSignal): Promise<Source> {
  const raw = await readFile(new URL("./data/knowledge-manuals.json", import.meta.url), { encoding: "utf8", signal });
  return sourceSchema.parse(JSON.parse(raw));
}

export function searchKnowledge(source: Source, input: unknown, actor: KnowledgeActor) {
  const { query } = querySchema.parse(input);
  // 先按服务端身份和有效版本过滤，再建立索引，避免无权片段进入检索结果。
  const chunks = source.documents.flatMap((document) => document.tenantId === actor.tenantId && document.roles.includes(actor.role)
    ? document.versions.filter((version) => version.active).flatMap((version) => version.sections.map((section) => ({
      id: `${document.id}:v${version.version}:${section.id}`,
      documentId: document.id, version: version.version, sectionId: section.id,
      title: document.title, heading: section.heading, content: section.content,
    }))) : []);
  const index = new MiniSearch({ fields: ["title", "heading", "content"], storeFields: ["documentId", "version", "sectionId", "title", "heading", "content"], tokenize });
  index.addAll(chunks);
  const hits = index.search(query, { combineWith: "AND" }).slice(0, 3);
  return { query, results: hits.map((hit) => ({
    documentId: String(hit.documentId), version: Number(hit.version), sectionId: String(hit.sectionId),
    title: String(hit.title), heading: String(hit.heading), content: String(hit.content),
  })) };
}
