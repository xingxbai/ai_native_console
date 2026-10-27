import { connection } from "next/server";
import { readApiHealth } from "../lib/api-health";

const modules = [
  { name: "智能分析台", detail: "自然语言分析与可核查依据", lesson: "Day 11/31" },
  { name: "工作流运行台", detail: "任务状态、步骤与人工审批", lesson: "Day 21-30" },
  { name: "评测与追踪", detail: "用例、执行记录与质量指标", lesson: "Day 34-35" },
];

export default async function Home() {
  await connection();
  const apiHealth = await readApiHealth();

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#17232a]">
      <header className="border-b border-[#dbe2e5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-[#173c42] text-sm font-semibold text-white">AI</span>
            <span className="text-base font-semibold">AI Native Console</span>
          </div>
          <span className="rounded-sm border border-[#c7d9ce] bg-[#eff8f1] px-2 py-1 text-xs font-medium text-[#2d6847]">Day 02 · API 契约</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8 border-b border-[#dbe2e5] pb-6">
          <p className="mb-2 text-xs font-semibold uppercase text-[#527c7e]">工作台</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">系统总览</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#596970]">基础服务与模型适配层已就绪。工作台现在可检查 API 连接；业务分析和对话入口尚未接入。</p>
        </div>

        <section aria-labelledby="status-heading" className="mb-8">
          <h2 id="status-heading" className="mb-3 text-sm font-semibold">当前状态</h2>
          <div className="grid gap-px border border-[#dbe2e5] bg-[#dbe2e5] sm:grid-cols-3">
            <div className="bg-white p-5"><p className="text-xs text-[#65747a]">当前课程</p><p className="mt-2 text-xl font-semibold">Day 02</p><p className="mt-1 text-xs text-[#65747a]">配置、契约与错误边界</p></div>
            <div className="bg-white p-5"><p className="text-xs text-[#65747a]">API 连接</p><p className={`mt-2 text-xl font-semibold ${apiHealth.status === "connected" ? "text-[#2d6847]" : "text-[#a04237]"}`}>{apiHealth.status === "connected" ? "已连接" : "暂不可用"}</p><p className="mt-1 break-all text-xs text-[#65747a]">{apiHealth.status === "connected" ? `请求 ID ${apiHealth.requestId}` : "请检查 API 服务"}</p></div>
            <div className="bg-white p-5"><p className="text-xs text-[#65747a]">模型接入</p><p className="mt-2 text-xl font-semibold text-[#2d6847]">已验证</p><p className="mt-1 text-xs text-[#65747a]">仅服务端；聊天入口待实现</p></div>
          </div>
        </section>

        <section aria-labelledby="modules-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="modules-heading" className="text-sm font-semibold">业务模块</h2>
            <span className="text-xs text-[#65747a]">按课程逐步解锁</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {modules.map((module) => (
              <article key={module.name} className="min-h-40 rounded-md border border-[#dbe2e5] bg-white p-5">
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{module.name}</h3><span className="shrink-0 text-xs text-[#4f7779]">{module.lesson}</span></div>
                <p className="mt-3 text-sm leading-6 text-[#65747a]">{module.detail}</p>
                <p className="mt-5 border-t border-[#edf0f1] pt-3 text-xs text-[#876733]">尚未接入</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
