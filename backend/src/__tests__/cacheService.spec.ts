/**
 * 🧪 Cache Service Tests
 * Tests para el servicio de caché (Redis/Memory)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { API_PRICES, cacheService } from "../services/cacheService";

// Mock de Redis
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    flushdb: vi.fn().mockResolvedValue("OK"),
    dbsize: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue("OK"),
    on: vi.fn(),
  })),
}));

describe("cacheService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(cacheService).toBeDefined();
    });

    test("Should have get method", () => {
      expect(typeof cacheService.get).toBe("function");
    });

    test("Should have set method", () => {
      expect(typeof cacheService.set).toBe("function");
    });

    test("Should have getStats method", () => {
      expect(typeof cacheService.getStats).toBe("function");
    });

    test("Should have clear method", () => {
      expect(typeof cacheService.clear).toBe("function");
    });

    test("Should have close method", () => {
      expect(typeof cacheService.close).toBe("function");
    });
  });

  describe("get method", () => {
    test("Should return null for non-existent key", async () => {
      const result = await cacheService.get("non-existent-key");

      expect(result).toBeNull();
    });

    test("Should accept generic type", async () => {
      const result = await cacheService.get<string>("test-key");

      expect(result).toBeNull();
    });
  });

  describe("set method", () => {
    test("Should not throw on set", async () => {
      await expect(
        cacheService.set("test-key", "test-value")
      ).resolves.not.toThrow();
    });

    test("Should accept TTL parameter", async () => {
      await expect(
        cacheService.set("test-key", "test-value", 3600)
      ).resolves.not.toThrow();
    });

    test("Should handle object values", async () => {
      await expect(
        cacheService.set("test-key", { data: "test" }, 60)
      ).resolves.not.toThrow();
    });
  });

  describe("Geocoding cache", () => {
    test("Should have getCachedGeocode method", () => {
      expect(typeof cacheService.getCachedGeocode).toBe("function");
    });

    test("Should have setCachedGeocode method", () => {
      expect(typeof cacheService.setCachedGeocode).toBe("function");
    });

    test("getCachedGeocode should return null for unknown location", async () => {
      const result = await cacheService.getCachedGeocode("unknown-location");

      expect(result).toBeNull();
    });

    test("setCachedGeocode should not throw", async () => {
      await expect(
        cacheService.setCachedGeocode("Buenos Aires", {
          lat: -34.6,
          lng: -58.4,
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Place details cache", () => {
    test("Should have getCachedPlaceDetails method", () => {
      expect(typeof cacheService.getCachedPlaceDetails).toBe("function");
    });

    test("Should have setCachedPlaceDetails method", () => {
      expect(typeof cacheService.setCachedPlaceDetails).toBe("function");
    });

    test("getCachedPlaceDetails should return null for unknown place", async () => {
      const result = await cacheService.getCachedPlaceDetails("unknown-place");

      expect(result).toBeNull();
    });
  });

  describe("Website analysis cache", () => {
    test("Should have getCachedWebsiteAnalysis method", () => {
      expect(typeof cacheService.getCachedWebsiteAnalysis).toBe("function");
    });

    test("Should have setCachedWebsiteAnalysis method", () => {
      expect(typeof cacheService.setCachedWebsiteAnalysis).toBe("function");
    });

    test("getCachedWebsiteAnalysis should return null for unknown URL", async () => {
      const result = await cacheService.getCachedWebsiteAnalysis(
        "https://unknown.com"
      );

      expect(result).toBeNull();
    });
  });

  describe("getStats method", () => {
    test("Should return stats object", async () => {
      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty("type");
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("connected");
    });

    test("Stats type should be redis or memory", async () => {
      const stats = await cacheService.getStats();

      expect(["redis", "memory"]).toContain(stats.type);
    });

    test("Stats size should be a number", async () => {
      const stats = await cacheService.getStats();

      expect(typeof stats.size).toBe("number");
    });

    test("Stats connected should be a boolean", async () => {
      const stats = await cacheService.getStats();

      expect(typeof stats.connected).toBe("boolean");
    });
  });

  describe("clear method", () => {
    test("Should not throw on clear", async () => {
      await expect(cacheService.clear()).resolves.not.toThrow();
    });
  });

  describe("close method", () => {
    test("Should not throw on close", async () => {
      await expect(cacheService.close()).resolves.not.toThrow();
    });
  });

  describe("API_PRICES constant", () => {
    test("Should be defined", () => {
      expect(API_PRICES).toBeDefined();
    });

    test("Should have geocoding price", () => {
      expect(API_PRICES.geocoding).toBeDefined();
      expect(typeof API_PRICES.geocoding).toBe("number");
    });

    test("Should have nearbySearch price", () => {
      expect(API_PRICES.nearbySearch).toBeDefined();
      expect(typeof API_PRICES.nearbySearch).toBe("number");
    });

    test("Should have placeDetails price", () => {
      expect(API_PRICES.placeDetails).toBeDefined();
      expect(typeof API_PRICES.placeDetails).toBe("number");
    });

    test("Prices should be positive", () => {
      expect(API_PRICES.geocoding).toBeGreaterThan(0);
      expect(API_PRICES.nearbySearch).toBeGreaterThan(0);
      expect(API_PRICES.placeDetails).toBeGreaterThan(0);
    });
  });

  describe("Memory cache fallback", () => {
    test("Should work without Redis", async () => {
      // El servicio debería funcionar incluso sin Redis
      await expect(cacheService.get("test")).resolves.not.toThrow();
    });
  });
});
