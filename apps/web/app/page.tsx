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
        <section aria-labelledby="ask-heading">
          <h2 id="ask-heading" className="mb-4 text-sm font-semibold">提问</h2>
          <AskPanel />
        </section>
      </div>
    </main>
  );
}
