import Link from "next/link";

export default function NavigationCheck() {
  return (
    <main className="min-h-screen bg-[#f5f7f8] px-5 py-8 text-[#17232a] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-[#207a74] hover:underline">← 返回提问</Link>
        <h1 className="mt-8 text-xl font-semibold">切换页面</h1>
      </div>
    </main>
  );
}
