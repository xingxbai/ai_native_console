import { afterEach, describe, expect, it, vi } from "vitest";
import { readApiHealth } from "./api-health";

const originalUrl = process.env.API_INTERNAL_URL;
const requestId = "ff786c21-7d64-44bb-97ad-d34f0aa1eed3";

afterEach(() => {
  if (originalUrl === undefined) delete process.env.API_INTERNAL_URL;
  else process.env.API_INTERNAL_URL = originalUrl;
  vi.unstubAllGlobals();
});

describe("server-side API health reader", () => {
  it("accepts only the shared health body and UUID header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "x-request-id": requestId },
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await readApiHealth()).toEqual({ status: "connected", requestId });
    expect(fetchMock).toHaveBeenCalledWith(new URL("http://127.0.0.1:3101/health"), expect.objectContaining({ cache: "no-store" }));
  });

  it.each([
    [200, { status: "wrong" }, requestId],
    [200, { status: "ok" }, "not-a-uuid"],
    [503, { status: "ok" }, requestId],
  ])("rejects an incompatible API response (%s)", async (status, body, id) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status,
      headers: { "x-request-id": id },
    })));

    expect(await readApiHealth()).toEqual({ status: "unavailable" });
  });

  it("handles a network failure without rendering an exception", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    expect(await readApiHealth()).toEqual({ status: "unavailable" });
  });

  it("rejects an invalid server origin before making a request", async () => {
    process.env.API_INTERNAL_URL = "https://user:pass@example.com";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await readApiHealth()).toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
