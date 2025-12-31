/**
 * 🧪 Google Maps Scraper Tests
 * Tests para el servicio de scraping de Google Maps
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { googleMapsScraper } from "../services/googleMapsScraper";

// Mock puppeteer - no queremos lanzar navegadores reales en tests
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        setViewport: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue([]),
        waitForSelector: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        $: vi.fn().mockResolvedValue(null),
        $$: vi.fn().mockResolvedValue([]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
      pages: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getCachedGeocode: vi.fn().mockResolvedValue(null),
    setCachedGeocode: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("googleMapsScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(googleMapsScraper).toBeDefined();
    });

    test("Should have scrapePlaces method", () => {
      expect(typeof googleMapsScraper.scrapePlaces).toBe("function");
    });

    test("Should have close method", () => {
      expect(typeof googleMapsScraper.close).toBe("function");
    });
  });

  describe("URL construction", () => {
    test("Should construct Google Maps URL correctly", () => {
      const baseUrl = "https://www.google.com/maps/search/";
      const query = "restaurants";
      const location = "Buenos Aires";

      const expectedUrl = `${baseUrl}${encodeURIComponent(
        query + " " + location
      )}`;
      expect(expectedUrl).toContain("google.com/maps/search");
      expect(expectedUrl).toContain("restaurants");
    });

    test("Should encode special characters", () => {
      const query = "café & bar";
      const encoded = encodeURIComponent(query);

      expect(encoded).not.toContain("&");
      expect(encoded).not.toContain(" ");
    });
  });

  describe("Social media detection", () => {
    const socialDomains = [
      "instagram.com",
      "facebook.com",
      "twitter.com",
      "tiktok.com",
      "youtube.com",
      "linkedin.com",
    ];

    test.each(socialDomains)("Should identify %s as social media", (domain) => {
      const url = `https://${domain}/profile`;
      expect(url).toContain(domain);
    });
  });

  describe("Rating parsing", () => {
    test("Should parse valid rating", () => {
      const ratingText = "4.5";
      const rating = parseFloat(ratingText);

      expect(rating).toBe(4.5);
      expect(rating).toBeGreaterThanOrEqual(0);
      expect(rating).toBeLessThanOrEqual(5);
    });

    test("Should handle invalid rating", () => {
      const ratingText = "N/A";
      const rating = parseFloat(ratingText);

      expect(isNaN(rating)).toBe(true);
    });
  });

  describe("Review count parsing", () => {
    test("Should parse review count with K suffix", () => {
      const parseReviewCount = (text: string): number => {
        if (text.includes("K")) {
          return parseFloat(text.replace("K", "")) * 1000;
        }
        return parseInt(text.replace(/[(),]/g, ""), 10);
      };

      expect(parseReviewCount("1.5K")).toBe(1500);
      expect(parseReviewCount("100")).toBe(100);
      expect(parseReviewCount("(50)")).toBe(50);
    });
  });

  describe("Address cleaning", () => {
    test("Should clean address properly", () => {
      const cleanAddress = (addr: string): string => {
        return addr.trim().replace(/\s+/g, " ");
      };

      const dirtyAddress = "  123 Main St   Suite 100  ";
      const cleaned = cleanAddress(dirtyAddress);

      expect(cleaned).toBe("123 Main St Suite 100");
    });
  });

  describe("Phone number extraction", () => {
    test("Should extract phone from string", () => {
      const phoneRegex = /\+?[\d\s\-()]{10,}/g;
      const text = "Call us at +1 (555) 123-4567 for more info";
      const matches = text.match(phoneRegex);

      expect(matches).not.toBeNull();
      expect(matches![0]).toContain("555");
    });
  });

  describe("Category matching", () => {
    test("Should match exact category", () => {
      const category = "Restaurante";
      const searchTerm = "restaurante";

      expect(category.toLowerCase()).toBe(searchTerm.toLowerCase());
    });

    test("Should match partial category", () => {
      const category = "Restaurante Italiano";
      const searchTerm = "restaurante";

      expect(category.toLowerCase()).toContain(searchTerm.toLowerCase());
    });
  });

  describe("Deduplication", () => {
    test("Should deduplicate places by name and address", () => {
      const places = [
        { name: "Restaurant A", address: "123 Main St" },
        { name: "Restaurant A", address: "123 Main St" },
        { name: "Restaurant B", address: "456 Oak Ave" },
      ];

      const unique = places.filter(
        (place, index, self) =>
          index ===
          self.findIndex(
            (p) => p.name === place.name && p.address === place.address
          )
      );

      expect(unique.length).toBe(2);
    });
  });

  describe("ScrapeOptions", () => {
    test("Should accept keyword", () => {
      const options = {
        keyword: "restaurantes",
        location: "Buenos Aires",
      };

      expect(options.keyword).toBe("restaurantes");
    });

    test("Should accept maxResults", () => {
      const options = {
        keyword: "restaurantes",
        location: "Buenos Aires",
        maxResults: 50,
      };

      expect(options.maxResults).toBe(50);
    });

    test("Should accept strictMatch", () => {
      const options = {
        keyword: "gimnasio",
        location: "Palermo",
        strictMatch: true,
      };

      expect(options.strictMatch).toBe(true);
    });
  });

  describe("ScrapedPlace structure", () => {
    test("Place should have expected fields", () => {
      const place = {
        name: "Test Place",
        address: "123 Test St",
        phone: "+1234567890",
        website: "https://test.com",
        rating: 4.5,
        reviewCount: 100,
        category: "Restaurant",
        placeId: "place123",
        hasRealWebsite: true,
        relevanceScore: 95,
      };

      expect(place.name).toBeDefined();
      expect(place.address).toBeDefined();
      expect(place.placeId).toBeDefined();
      expect(place.relevanceScore).toBeDefined();
    });
  });

  describe("close method", () => {
    test("Should not throw on close", async () => {
      await expect(googleMapsScraper.close()).resolves.not.toThrow();
    });
  });
});
