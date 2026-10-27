import { apiErrorResponseSchema, healthResponseSchema, requestIdSchema } from "@ai-native-console/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API contract", () => {
  it("returns validated health data and a generated request ID", async () => {
    const app = createApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "request-id": "client-controlled" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(healthResponseSchema.parse(response.json())).toEqual({ status: "ok" });
    expect(requestIdSchema.safeParse(response.headers["x-request-id"]).success).toBe(true);
    expect(response.headers["x-request-id"]).not.toBe("client-controlled");
    await app.close();
  });

  it("uses a new request ID for each request", async () => {
    const app = createApp({ logger: false });
    const first = await app.inject({ method: "GET", url: "/health" });
    const second = await app.inject({ method: "GET", url: "/health" });

    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
    await app.close();
  });

  it("rejects unknown health query parameters with the error contract", async () => {
    const app = createApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/health?unexpected=1" });
    const body = apiErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(body.error.message).toBe("Invalid query parameters");
    await app.close();
  });

  it.each([
    ["GET", "/missing"],
    ["POST", "/health"],
  ])("returns a consistent 404 for %s %s", async (method, url) => {
    const app = createApp({ logger: false });
    const response = await app.inject({ method, url });
    const body = apiErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
    await app.close();
  });

  it("does not expose internal exception details", async () => {
    const app = createApp({ logger: false });
    app.get("/__test/failure", async () => {
      throw new Error("private diagnostic value");
    });
    const response = await app.inject({ method: "GET", url: "/__test/failure" });
    const body = apiErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body).not.toContain("private diagnostic value");
    await app.close();
  });
});
