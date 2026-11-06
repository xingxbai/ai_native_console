import { getApiInternalUrl } from "../../../../lib/api-health";

export async function POST(request: Request) {
  const baseUrl = getApiInternalUrl();
  if (!baseUrl) return Response.json({ valid: false, issues: ["API 暂不可用"] }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 32_000) return Response.json({ valid: false, issues: ["流程数据过大"] }, { status: 413 });
    const response = await fetch(new URL("/api/v1/workflows/validate", baseUrl), {
      method: "POST", headers: { "content-type": "application/json" }, body,
      cache: "no-store", signal: AbortSignal.timeout(3_000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ valid: false, issues: ["校验服务暂不可用"] }, { status: 503 });
  }
}
