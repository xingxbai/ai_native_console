import { connection } from "next/server";
import { readApiHealth } from "../lib/api-health";
import { AskPanel } from "./ask-panel";

export default async function Home() {
  await connection();
  const apiHealth = await readApiHealth();

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#17232a]">
      <header className="border-b border-[#dbe2e5] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-[#173c42] text-sm font-semibold text-white">AI</span>
            <span className="text-base font-semibold">AI Native Console</span>
          </div>
          <span className={`text-xs font-medium ${apiHealth.status === "connected" ? "text-[#2d6847]" : "text-[#a04237]"}`}>
            <span aria-hidden="true">{apiHealth.status === "connected" ? "●" : "○"}</span>{" "}
            {apiHealth.status === "connected" ? "API 运行中" : "API 暂不可用"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-6 border-b border-[#dbe2e5] pb-5">
          <h1 className="text-2xl font-semibold sm:text-3xl">面试题与场景练习</h1>
          <p className="mt-2 text-sm leading-6 text-[#596970]">围绕 AI Agent 工程问题提问，或选择一个实际开发情境。当前是单次 DeepSeek 回复，不读取仓库或业务数据。</p>
        </div>
        <section aria-labelledby="ask-heading">
          <h2 id="ask-heading" className="mb-4 text-sm font-semibold">提问</h2>
          <AskPanel />
        </section>
      </div>
    </main>
  );
}
