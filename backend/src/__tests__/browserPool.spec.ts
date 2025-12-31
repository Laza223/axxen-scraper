/**
 * 🧪 Browser Pool Tests
 * Tests para el pool de navegadores
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock de puppeteer - debe estar ANTES del import
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
      pages: vi.fn().mockResolvedValue([]),
      newPage: vi.fn().mockResolvedValue({
        close: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(null),
        setUserAgent: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn().mockResolvedValue(undefined),
      }),
      isConnected: vi.fn().mockReturnValue(true),
    }),
  },
}));

// Importar DESPUÉS de los mocks
import { browserPool } from "../services/browserPool";

describe("browserPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(browserPool).toBeDefined();
    });

    test("Should have initialize method", () => {
      expect(typeof browserPool.initialize).toBe("function");
    });

    test("Should have acquire method", () => {
      expect(typeof browserPool.acquire).toBe("function");
    });

    test("Should have release method", () => {
      expect(typeof browserPool.release).toBe("function");
    });

    test("Should have getStats method", () => {
      expect(typeof browserPool.getStats).toBe("function");
    });

    test("Should have shutdown method", () => {
      expect(typeof browserPool.shutdown).toBe("function");
    });
  });

  describe("initialize", () => {
    test("Should not throw on initialize", async () => {
      await expect(browserPool.initialize()).resolves.not.toThrow();
    });
  });

  describe("getStats", () => {
    test("Should return stats object", () => {
      const stats = browserPool.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
    });

    test("Should have total property", () => {
      const stats = browserPool.getStats();
      expect(stats).toHaveProperty("total");
      expect(typeof stats.total).toBe("number");
    });

    test("Should have available property", () => {
      const stats = browserPool.getStats();
      expect(stats).toHaveProperty("available");
      expect(typeof stats.available).toBe("number");
    });

    test("Should have inUse property", () => {
      const stats = browserPool.getStats();
      expect(stats).toHaveProperty("inUse");
      expect(typeof stats.inUse).toBe("number");
    });

    test("Should have totalPagesOpened property", () => {
      const stats = browserPool.getStats();
      expect(stats).toHaveProperty("totalPagesOpened");
      expect(typeof stats.totalPagesOpened).toBe("number");
    });

    test("Total should be >= 0", () => {
      const stats = browserPool.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    test("Available should be >= 0", () => {
      const stats = browserPool.getStats();
      expect(stats.available).toBeGreaterThanOrEqual(0);
    });

    test("InUse should be >= 0", () => {
      const stats = browserPool.getStats();
      expect(stats.inUse).toBeGreaterThanOrEqual(0);
    });
  });

  describe("acquire", () => {
    test("Acquire method should exist", () => {
      expect(typeof browserPool.acquire).toBe("function");
    });
  });

  describe("release", () => {
    test("Release method should exist", () => {
      expect(typeof browserPool.release).toBe("function");
    });

    test("Should handle release of non-existent browser", async () => {
      await expect(
        browserPool.release("non-existent-id")
      ).resolves.not.toThrow();
    });
  });

  describe("shutdown", () => {
    test("Shutdown method should exist", () => {
      expect(typeof browserPool.shutdown).toBe("function");
    });

    test("Should not throw on shutdown", async () => {
      await expect(browserPool.shutdown()).resolves.not.toThrow();
    });

    test("Should be idempotent", async () => {
      await browserPool.shutdown();
      await expect(browserPool.shutdown()).resolves.not.toThrow();
    });
  });

  describe("Pool stats structure", () => {
    test("Stats should have all required properties", () => {
      const stats = browserPool.getStats();

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("available");
      expect(stats).toHaveProperty("inUse");
      expect(stats).toHaveProperty("totalPagesOpened");
    });

    test("Available should not exceed total", () => {
      const stats = browserPool.getStats();
      expect(stats.available).toBeLessThanOrEqual(stats.total);
    });

    test("InUse should not exceed total", () => {
      const stats = browserPool.getStats();
      expect(stats.inUse).toBeLessThanOrEqual(stats.total);
    });

    test("Available + inUse should equal total", () => {
      const stats = browserPool.getStats();
      expect(stats.available + stats.inUse).toBe(stats.total);
    });
  });

  describe("Pool configuration", () => {
    test("Pool should have max browsers limit", () => {
      const stats = browserPool.getStats();
      expect(stats.total).toBeLessThanOrEqual(10);
    });
  });
});
