import { describe, expect, it } from "vitest";
import { createModelProvider } from "./model-provider.js";

describe("model provider adapter", () => {
  it("returns deterministic mock output without a key or network access", async () => {
    const provider = createModelProvider({ kind: "mock" });

    expect(provider.kind).toBe("mock");
    expect(await provider.generate("  hello  ")).toBe("Mock response: hello");
  });

  it("rejects empty or oversized prompts before generation", async () => {
    const provider = createModelProvider({ kind: "mock" });

    await expect(provider.generate(" ")).rejects.toThrow();
    await expect(provider.generate("a".repeat(501))).rejects.toThrow();
  });

  it("rejects a missing DeepSeek key before a request can be made", () => {
    expect(() => createModelProvider({ kind: "deepseek", apiKey: " " })).toThrow();
  });

  it("rejects unsupported model IDs", () => {
    expect(() =>
      createModelProvider({ kind: "deepseek", apiKey: "test-key", model: "unknown-model" }),
    ).toThrow();
  });

  it("does not expose the configured key in the provider contract", () => {
    const provider = createModelProvider({ kind: "deepseek", apiKey: "test-key" });

    expect(provider.model).toBe("deepseek-v4-flash");
    expect(JSON.stringify(provider)).not.toContain("test-key");
  });
});
