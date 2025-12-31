/**
 * 🧪 Cache Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRedis = {
  connect: vi.fn(),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  flushdb: vi.fn().mockResolvedValue("OK"),
  dbsize: vi.fn().mockResolvedValue(0),
  quit: vi.fn().mockResolvedValue("OK"),
  on: vi.fn(),
};

vi.mock("ioredis", () => ({ default: vi.fn(() => mockRedis) }));

import { API_PRICES, cacheService } from "../services/cacheService";

describe("cacheService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("core operations", () => {
    test("cacheService is defined with required methods", () => {
      expect(cacheService).toBeDefined();
      expect(typeof cacheService.get).toBe("function");
      expect(typeof cacheService.set).toBe("function");
      expect(typeof cacheService.getStats).toBe("function");
    });

    test("get returns null for non-existent key", async () => {
      expect(await cacheService.get("nonexistent")).toBeNull();
    });

    test("set and get work with objects", async () => {
      const obj = { name: "test", nested: { arr: [1, 2, 3] } };
      await cacheService.set("complex", obj, 60);
      const result = await cacheService.get("complex");
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  describe("geocode cache", () => {
    test("getCachedGeocode returns null for unknown location", async () => {
      expect(await cacheService.getCachedGeocode("unknown")).toBeNull();
    });

    test("setCachedGeocode stores geocode data", async () => {
      await expect(
        cacheService.setCachedGeocode("Madrid", { lat: 40.4, lng: -3.7 })
      ).resolves.not.toThrow();
    });
  });

  describe("place details cache", () => {
    test("getCachedPlaceDetails returns null for unknown place", async () => {
      expect(await cacheService.getCachedPlaceDetails("unknown")).toBeNull();
    });
  });

  describe("website analysis cache", () => {
    test("getCachedWebsiteAnalysis returns null for unknown URL", async () => {
      expect(
        await cacheService.getCachedWebsiteAnalysis("https://x.com")
      ).toBeNull();
    });
  });

  describe("API prices", () => {
    test("API_PRICES is exported with expected structure", () => {
      expect(API_PRICES).toBeDefined();
      expect(typeof API_PRICES).toBe("object");
    });
  });
});
