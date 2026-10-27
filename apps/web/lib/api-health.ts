import { healthResponseSchema, requestIdSchema } from "@ai-native-console/contracts";

export type ApiHealth =
  | { status: "connected"; requestId: string }
  | { status: "unavailable" };

export async function readApiHealth(): Promise<ApiHealth> {
  try {
    const baseUrl = new URL(process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3101");
    if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password
      || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
      return { status: "unavailable" };
    }

    const response = await fetch(new URL("/health", baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok || !healthResponseSchema.safeParse(await response.json()).success) {
      return { status: "unavailable" };
    }

    const requestId = requestIdSchema.safeParse(response.headers.get("x-request-id"));
    return requestId.success
      ? { status: "connected", requestId: requestId.data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
