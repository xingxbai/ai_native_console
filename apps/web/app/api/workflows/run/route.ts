import { getApiInternalUrl } from "../../../../lib/api-health";

export async function POST(request: Request) {
  const baseUrl = getApiInternalUrl();
  if (!baseUrl) return Response.json({ error: "API 暂不可用" }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 32_000) return Response.json({ error: "流程数据过大" }, { status: 413 });
    const response = await fetch(new URL("/api/v1/workflows/run", baseUrl), {
      method: "POST", headers: { "content-type": "application/json" }, body,
      cache: "no-store", signal: request.signal,
    });
    if (!response.ok) return Response.json({ error: "流程结构不合法" }, { status: response.status });
    return new Response(response.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" } });
  } catch {
    return Response.json({ error: "运行服务暂不可用" }, { status: 503 });
  }
}
