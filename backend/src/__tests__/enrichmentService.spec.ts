/**
 * 🧪 Enrichment Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        data: "<html><body>Content</body></html>",
        status: 200,
        request: { res: { responseUrl: "https://example.com" } },
      }),
      head: vi.fn().mockResolvedValue({ status: 200 }),
    })),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: {
    getCachedWebsiteAnalysis: vi.fn().mockResolvedValue(null),
    setCachedWebsiteAnalysis: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  },
  cacheService: {
    getCachedWebsiteAnalysis: vi.fn().mockResolvedValue(null),
    setCachedWebsiteAnalysis: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  },
}));

import { enrichmentService } from "../services/enrichmentService";

describe("enrichmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeWebsite", () => {
    test("handles undefined/empty URL", async () => {
      const result = await enrichmentService.analyzeWebsite();
      expect(result.hasWebsite).toBe(false);

      const result2 = await enrichmentService.analyzeWebsite("");
      expect(result2).toHaveProperty("hasWebsite");
    });

    test("returns complete analysis structure", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");

      expect(result).toHaveProperty("hasWebsite");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("emails");
      expect(result).toHaveProperty("phones");
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe("enrichLead", () => {
    const mockLead = {
      businessName: "Test Restaurant",
      category: "Restaurant",
      googleRating: 4.5,
      reviewCount: 100,
      websiteUrl: "https://test.com",
      phoneRaw: "+1234567890",
      location: "Buenos Aires",
    };

    test("returns complete enrichment data", async () => {
      const result = await enrichmentService.enrichLead(mockLead);

      expect(result).toHaveProperty("websiteAnalysis");
      expect(result).toHaveProperty("leadScore");
      expect(result).toHaveProperty("painPoints");
      expect(result).toHaveProperty("opportunities");
      expect(result.leadScore).toBeGreaterThanOrEqual(0);
      expect(result.leadScore).toBeLessThanOrEqual(100);
    });

    test("handles lead without website", async () => {
      const leadNoWebsite = { ...mockLead, websiteUrl: undefined };
      const result = await enrichmentService.enrichLead(leadNoWebsite);
      expect(result).toHaveProperty("websiteAnalysis");
    });
  });
});
