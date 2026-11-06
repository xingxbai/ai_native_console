import Link from "next/link";
import { WorkflowEditor } from "./workflow-editor";

export default function WorkflowPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#17232a]">
      <header className="border-b border-[#dbe2e5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md bg-[#173c42] text-sm font-semibold text-white">AI</span>
            <span className="text-base font-semibold">AI Native Console</span>
          </div>
          <Link href="/" className="text-sm font-medium text-[#207a74] hover:underline">返回问答</Link>
        </div>
      </header>
      <WorkflowEditor />
    </main>
  );
}
