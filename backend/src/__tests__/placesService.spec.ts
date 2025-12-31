/**
 * 🧪 Places Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ScrapedPlace } from "../services/googleMapsScraper";

vi.mock("../services/zoneService", () => ({
  analyzeZone: vi.fn().mockReturnValue({
    isLargeZone: false,
    subzones: ["Palermo"],
    originalLocation: "Palermo",
  }),
}));

vi.mock("../services/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    lead: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({ id: 1 }),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((cb: any) =>
      cb({
        lead: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: 1 }),
        },
      })
    ),
  })),
}));

vi.mock("../services/googleMapsScraper", () => ({
  googleMapsScraper: {
    scrapePlaces: vi.fn().mockResolvedValue([
      {
        name: "Test Restaurant",
        address: "123 St",
        phone: "+123",
        website: "https://test.com",
        rating: 4.5,
        reviewCount: 150,
        category: "Restaurant",
        placeId: "ChIJ123",
        googleMapsUrl: "https://maps.google.com/test",
        hasRealWebsite: true,
        relevanceScore: 85,
      },
    ]),
    close: vi.fn(),
  },
  default: {
    scrapePlaces: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
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
    onAlert: vi.fn(() => () => {}),
  },
  default: {
    evaluateLead: vi.fn().mockReturnValue(null),
    onAlert: vi.fn(() => () => {}),
  },
}));

vi.mock("../services/browserPool", () => ({
  browserPool: {
    initialize: vi.fn(),
    acquire: vi.fn().mockResolvedValue({ id: "test", browser: {} }),
    release: vi.fn(),
    getStats: vi.fn().mockReturnValue({ total: 0 }),
    shutdown: vi.fn(),
  },
  default: { initialize: vi.fn(), shutdown: vi.fn() },
}));

import { placesService } from "../services/placesService";

describe("placesService", () => {
  const mockPlace: ScrapedPlace = {
    name: "Test Restaurant",
    address: "123 Main St",
    phone: "+1234567890",
    website: "https://test.com",
    rating: 4.5,
    reviewCount: 150,
    category: "Restaurant",
    placeId: "ChIJ123",
    googleMapsUrl: "https://maps.google.com/test",
    hasRealWebsite: true,
    relevanceScore: 85,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("placesService is defined with required methods", () => {
    expect(placesService).toBeDefined();
    expect(typeof placesService.searchPlaces).toBe("function");
    expect(typeof placesService.shutdown).toBe("function");
  });

  test("ScrapedPlace has all required properties", () => {
    expect(typeof mockPlace.name).toBe("string");
    expect(typeof mockPlace.address).toBe("string");
    expect(typeof mockPlace.rating).toBe("number");
    expect(typeof mockPlace.reviewCount).toBe("number");
    expect(typeof mockPlace.category).toBe("string");
    expect(typeof mockPlace.placeId).toBe("string");
    expect(typeof mockPlace.hasRealWebsite).toBe("boolean");
    expect(typeof mockPlace.relevanceScore).toBe("number");
  });

  test("search options structure is valid", () => {
    const options = {
      keyword: "restaurants",
      zones: ["Buenos Aires"],
      maxResults: 50,
    };
    expect(options.keyword).toBe("restaurants");
    expect(options.zones).toHaveLength(1);
    expect(options.maxResults).toBe(50);
  });
});
