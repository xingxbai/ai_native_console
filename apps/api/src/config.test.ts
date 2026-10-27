import { describe, expect, it } from "vitest";
import { ConfigError, loadApiConfig } from "./config.js";

describe("API configuration", () => {
  it("uses local development defaults when optional variables are absent", () => {
    expect(loadApiConfig({})).toEqual({ host: "127.0.0.1", port: 3101 });
  });

  it("accepts a valid explicit host and port", () => {
    expect(loadApiConfig({ API_HOST: "0.0.0.0", API_PORT: "4101" }))
      .toEqual({ host: "0.0.0.0", port: 4101 });
  });

  it("rejects a blank host without logging the supplied value", () => {
    expect(() => loadApiConfig({ API_HOST: "   " })).toThrow(ConfigError);
    try {
      loadApiConfig({ API_HOST: "   " });
    } catch (error) {
      expect(error).toMatchObject({ fields: ["API_HOST"] });
    }
  });

  it.each(["", "0", "65536", "abc", "3.5", " 3101"])("rejects invalid port %j", (port) => {
    expect(() => loadApiConfig({ API_PORT: port })).toThrow(ConfigError);
    try {
      loadApiConfig({ API_PORT: port });
    } catch (error) {
      expect(error).toMatchObject({ fields: ["API_PORT"] });
      expect(String(error)).not.toContain(port || "not-a-real-secret");
    }
  });
});
