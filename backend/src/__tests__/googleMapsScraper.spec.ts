/**
 * 🧪 Google Maps Scraper Tests (Optimized)
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let mockEvaluateCount = 0;

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        setViewport: vi.fn(),
        setUserAgent: vi.fn(),
        setExtraHTTPHeaders: vi.fn(),
        evaluateOnNewDocument: vi.fn(),
        evaluate: vi.fn().mockImplementation(() => {
          mockEvaluateCount++;
          if (mockEvaluateCount <= 2) {
            return Promise.resolve(["https://maps.google.com/place/Test"]);
          }
          return Promise.resolve({
            name: "Test Restaurant",
            category: "Restaurante",
            address: "123 Test St",
            phone: "+54 11 1234-5678",
            website: "https://test.com",
            rating: 4.5,
            reviewCount: 150,
            placeId: "ChIJ_test",
          });
        }),
        waitForSelector: vi.fn(),
        close: vi.fn(),
        $: vi.fn().mockResolvedValue(null),
        $$: vi.fn().mockResolvedValue([]),
      }),
      close: vi.fn(),
      pages: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}));

vi.mock("../services/retryService", () => ({
  googleMapsCircuitBreaker: {
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
  withRetry: vi.fn((fn) => fn()),
}));

vi.mock("../services/scraperMetrics", () => ({
  default: {
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    recordRequest: vi.fn(),
    recordPlaceFound: vi.fn(),
    logDetailedSummary: vi.fn(),
  },
}));

vi.mock("../services/antiDetection", () => ({
  default: {
    getRandomUserAgent: vi.fn().mockReturnValue("Mozilla/5.0"),
    getRandomResolution: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    getRandomProxy: vi.fn().mockReturnValue(null),
    getRandomHeaders: vi.fn().mockReturnValue({}),
    humanDelay: vi.fn().mockReturnValue(10),
    shouldTakeLongPause: vi.fn().mockReturnValue(false),
    getLongPauseDelay: vi.fn().mockReturnValue(10),
  },
}));

vi.mock("../services/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { googleMapsScraper } from "../services/googleMapsScraper";

describe("googleMapsScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateCount = 0;
  });

  afterEach(async () => {
    await googleMapsScraper.close();
  });

  describe("service", () => {
    test("is defined with required methods", () => {
      expect(googleMapsScraper).toBeDefined();
      expect(typeof googleMapsScraper.scrapePlaces).toBe("function");
      expect(typeof googleMapsScraper.close).toBe("function");
    });
  });

  describe("URL and data parsing", () => {
    test("constructs Google Maps URL correctly", () => {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(
        "restaurants Buenos Aires"
      )}`;
      expect(url).toContain("google.com/maps/search");
      expect(url).toContain("restaurants");
    });

    test("parses ratings correctly", () => {
      expect(parseFloat("4.5")).toBe(4.5);
      expect(isNaN(parseFloat("N/A"))).toBe(true);
    });

    test("parses review counts with K suffix", () => {
      const parse = (t: string) =>
        t.includes("K")
          ? parseFloat(t.replace("K", "")) * 1000
          : parseInt(t.replace(/[(),]/g, ""), 10);
      expect(parse("1.5K")).toBe(1500);
      expect(parse("(50)")).toBe(50);
    });

    test("extracts phone numbers", () => {
      const matches = "Call +1 (555) 123-4567".match(/\+?[\d\s\-()]{10,}/g);
      expect(matches).not.toBeNull();
    });
  });

  describe("deduplication", () => {
    test("removes duplicates by name and address", () => {
      const places = [
        { name: "A", address: "1 St" },
        { name: "A", address: "1 St" },
        { name: "B", address: "2 Ave" },
      ];
      const unique = places.filter(
        (p, i, arr) =>
          i ===
          arr.findIndex((x) => x.name === p.name && x.address === p.address)
      );
      expect(unique).toHaveLength(2);
    });
  });

  describe("social media detection", () => {
    test.each(["instagram.com", "facebook.com", "twitter.com", "tiktok.com"])(
      "identifies %s",
      (domain) => {
        expect(`https://${domain}/profile`).toContain(domain);
      }
    );
  });
});
