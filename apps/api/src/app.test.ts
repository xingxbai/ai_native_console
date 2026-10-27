import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("health endpoint", () => {
  it("returns a JSON ready response", async () => {
    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("does not treat an unknown route as healthy", async () => {
    const app = createApp();
    const response = await app.inject({ method: "GET", url: "/missing" });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("does not accept a write request to health", async () => {
    const app = createApp();
    const response = await app.inject({ method: "POST", url: "/health" });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
