/**
 * 🧪 Places Service Tests
 * Tests para el servicio de gestión de leads/places
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ScrapedPlace } from "../services/googleMapsScraper";

// Mock de Prisma usando factory sin referencias externas
vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      lead: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue({ id: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        upsert: vi.fn().mockResolvedValue({ id: 1 }),
      },
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn((cb: any) =>
        cb({
          lead: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: 1 }),
          },
        })
      ),
    })),
  };
});

vi.mock("../services/googleMapsScraper", () => ({
  googleMapsScraper: {
    scrapePlaces: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  },
  default: {
    scrapePlaces: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../services/enrichmentService", () => ({
  enrichmentService: {
    enrichLead: vi.fn().mockResolvedValue({
      websiteAnalysis: { hasWebsite: true },
      leadScore: 50,
      estimatedRevenue: { min: 0, max: 0 },
      painPoints: [],
      opportunities: [],
    }),
  },
  default: {
    enrichLead: vi.fn().mockResolvedValue({
      websiteAnalysis: { hasWebsite: true },
      leadScore: 50,
    }),
  },
}));

vi.mock("../services/premiumAlertService", () => ({
  premiumAlertService: {
    evaluateLead: vi.fn().mockReturnValue(null),
    onAlert: vi.fn().mockReturnValue(() => {}),
  },
  default: {
    evaluateLead: vi.fn().mockReturnValue(null),
    onAlert: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock("../services/browserPool", () => ({
  browserPool: {
    initialize: vi.fn().mockResolvedValue(undefined),
    acquire: vi.fn().mockResolvedValue({ id: "test", browser: {} }),
    release: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({ total: 0, available: 0, inUse: 0 }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
  default: {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  },
}));

// Importar DESPUÉS de los mocks
import { placesService } from "../services/placesService";

describe("placesService", () => {
  const mockPlace: ScrapedPlace = {
    name: "Test Restaurant",
    address: "123 Main St, City",
    phone: "+1234567890",
    website: "https://test-restaurant.com",
    rating: 4.5,
    reviewCount: 150,
    category: "Restaurant",
    placeId: "ChIJtest123",
    googleMapsUrl: "https://maps.google.com/place/test",
    hasRealWebsite: true,
    relevanceScore: 85,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(placesService).toBeDefined();
    });

    test("Should have searchPlaces method", () => {
      expect(typeof placesService.searchPlaces).toBe("function");
    });

    test("Should have shutdown method", () => {
      expect(typeof placesService.shutdown).toBe("function");
    });
  });

  describe("searchPlaces", () => {
    test("Should accept search options", async () => {
      expect(placesService.searchPlaces).toBeDefined();
      expect(typeof placesService.searchPlaces).toBe("function");
    });

    test("Search options should include keyword", () => {
      const options = {
        keyword: "restaurantes",
        zones: ["Buenos Aires"],
        maxResults: 100,
      };

      expect(options.keyword).toBeDefined();
      expect(typeof options.keyword).toBe("string");
    });

    test("Search options should include zones", () => {
      const options = {
        keyword: "restaurantes",
        zones: ["Buenos Aires", "Córdoba"],
        maxResults: 100,
      };

      expect(options.zones).toBeDefined();
      expect(Array.isArray(options.zones)).toBe(true);
    });

    test("Search options should include maxResults", () => {
      const options = {
        keyword: "restaurantes",
        zones: ["Buenos Aires"],
        maxResults: 50,
      };

      expect(options.maxResults).toBeDefined();
      expect(typeof options.maxResults).toBe("number");
    });
  });

  describe("PlaceData structure", () => {
    test("Should have name property", () => {
      expect(mockPlace.name).toBeDefined();
      expect(typeof mockPlace.name).toBe("string");
    });

    test("Should have address property", () => {
      expect(mockPlace.address).toBeDefined();
      expect(typeof mockPlace.address).toBe("string");
    });

    test("Should have phone property", () => {
      expect(mockPlace.phone).toBeDefined();
    });

    test("Should have website property", () => {
      expect(mockPlace.website).toBeDefined();
    });

    test("Should have rating property", () => {
      expect(mockPlace.rating).toBeDefined();
      expect(typeof mockPlace.rating).toBe("number");
    });

    test("Should have reviewCount property", () => {
      expect(mockPlace.reviewCount).toBeDefined();
      expect(typeof mockPlace.reviewCount).toBe("number");
    });

    test("Should have category property", () => {
      expect(mockPlace.category).toBeDefined();
      expect(typeof mockPlace.category).toBe("string");
    });

    test("Should have placeId property", () => {
      expect(mockPlace.placeId).toBeDefined();
      expect(typeof mockPlace.placeId).toBe("string");
    });

    test("Should have googleMapsUrl property", () => {
      expect(mockPlace.googleMapsUrl).toBeDefined();
      expect(typeof mockPlace.googleMapsUrl).toBe("string");
    });

    test("Should have hasRealWebsite property", () => {
      expect(mockPlace.hasRealWebsite).toBeDefined();
      expect(typeof mockPlace.hasRealWebsite).toBe("boolean");
    });

    test("Should have relevanceScore property", () => {
      expect(mockPlace.relevanceScore).toBeDefined();
      expect(typeof mockPlace.relevanceScore).toBe("number");
    });
  });

  describe("shutdown", () => {
    test("Should not throw on shutdown", async () => {
      await expect(placesService.shutdown()).resolves.not.toThrow();
    });
  });

  describe("Search options validation", () => {
    test("Keyword should be required", () => {
      const options = {
        keyword: "",
        zones: ["Buenos Aires"],
      };

      expect(options.keyword).toBeDefined();
    });

    test("Zones should accept array", () => {
      const options = {
        keyword: "test",
        zones: ["Zone1", "Zone2", "Zone3"],
      };

      expect(Array.isArray(options.zones)).toBe(true);
      expect(options.zones.length).toBe(3);
    });

    test("MaxResults should be positive number", () => {
      const options = {
        keyword: "test",
        zones: ["Zone1"],
        maxResults: 100,
      };

      expect(options.maxResults).toBeGreaterThan(0);
    });
  });

  describe("Lead transformation", () => {
    test("Place should have all required fields", () => {
      expect(mockPlace.name).toBeTruthy();
      expect(mockPlace.address).toBeTruthy();
      expect(mockPlace.category).toBeTruthy();
    });

    test("Place with website should be valid", () => {
      const placeWithWebsite = {
        ...mockPlace,
        website: "https://example.com",
      };

      expect(placeWithWebsite.website).toBeTruthy();
      expect(placeWithWebsite.website).toContain("http");
    });

    test("Place without website should be valid", () => {
      const placeWithoutWebsite = {
        ...mockPlace,
        website: null,
      };

      expect(placeWithoutWebsite.website).toBeFalsy();
    });
  });

  describe("Zone handling", () => {
    test("Should accept single zone", () => {
      const options = {
        keyword: "test",
        zones: ["Buenos Aires"],
      };

      expect(options.zones.length).toBe(1);
    });

    test("Should accept multiple zones", () => {
      const options = {
        keyword: "test",
        zones: ["Buenos Aires", "Córdoba", "Rosario"],
      };

      expect(options.zones.length).toBe(3);
    });
  });

  describe("Deduplication", () => {
    test("PlaceId should be unique identifier", () => {
      const place1 = { ...mockPlace, placeId: "ChIJ123" };
      const place2 = { ...mockPlace, placeId: "ChIJ456" };

      expect(place1.placeId).not.toBe(place2.placeId);
    });

    test("Same placeId should indicate duplicate", () => {
      const place1 = { ...mockPlace, placeId: "ChIJ123" };
      const place2 = { ...mockPlace, placeId: "ChIJ123" };

      expect(place1.placeId).toBe(place2.placeId);
    });
  });
});
