/**
 * 🧪 Browser Pool Tests (Optimized)
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setViewport: vi.fn(),
        setExtraHTTPHeaders: vi.fn(),
        evaluateOnNewDocument: vi.fn(),
        setUserAgent: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
      connected: true,
    }),
  },
}));

vi.mock("../services/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/antiDetection", () => ({
  default: {
    getRandomUserAgent: vi.fn().mockReturnValue("Mozilla/5.0"),
    getRandomResolution: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    getRandomHeaders: vi.fn().mockReturnValue({}),
    getRandomLanguage: vi.fn().mockReturnValue("es-AR"),
  },
}));

import { browserPool } from "../services/browserPool";

describe("browserPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await browserPool.shutdown().catch(() => {});
  });

  test("browserPool is defined with required methods", () => {
    expect(browserPool).toBeDefined();
    expect(typeof browserPool.initialize).toBe("function");
    expect(typeof browserPool.acquire).toBe("function");
    expect(typeof browserPool.release).toBe("function");
    expect(typeof browserPool.shutdown).toBe("function");
    expect(typeof browserPool.getStats).toBe("function");
  });

  test("getStats returns pool statistics", () => {
    const stats = browserPool.getStats();
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("available");
    expect(stats).toHaveProperty("inUse");
  });
});
