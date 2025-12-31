/**
 * 🧪 Enrichment Service Tests
 * Tests para el servicio de enriquecimiento de datos
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { enrichmentService } from "../services/enrichmentService";

// Mocks necesarios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        data: "<html><body>Test content</body></html>",
        status: 200,
        request: { res: { responseUrl: "https://example.com" } },
      }),
      head: vi.fn().mockResolvedValue({ status: 200 }),
    })),
    get: vi.fn().mockResolvedValue({ data: "<html></html>", status: 200 }),
    head: vi.fn().mockResolvedValue({ status: 200 }),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getCachedWebsiteAnalysis: vi.fn().mockResolvedValue(null),
    setCachedWebsiteAnalysis: vi.fn().mockResolvedValue(undefined),
  },
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getCachedWebsiteAnalysis: vi.fn().mockResolvedValue(null),
    setCachedWebsiteAnalysis: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("enrichmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(enrichmentService).toBeDefined();
    });

    test("Should have analyzeWebsite method", () => {
      expect(typeof enrichmentService.analyzeWebsite).toBe("function");
    });

    test("Should have enrichLead method", () => {
      expect(typeof enrichmentService.enrichLead).toBe("function");
    });
  });

  describe("analyzeWebsite", () => {
    test("Should handle undefined URL", async () => {
      const result = await enrichmentService.analyzeWebsite();

      expect(result).toHaveProperty("hasWebsite");
      expect(result.hasWebsite).toBe(false);
    });

    test("Should handle empty URL", async () => {
      const result = await enrichmentService.analyzeWebsite("");

      expect(result).toHaveProperty("hasWebsite");
    });

    test("Should return proper structure", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");

      expect(result).toHaveProperty("hasWebsite");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("issues");
      expect(Array.isArray(result.issues)).toBe(true);
    });

    test("Should have hasSslCertificate property", async () => {
      const result = await enrichmentService.analyzeWebsite(
        "https://secure.com"
      );
      expect(result).toHaveProperty("hasSslCertificate");
    });

    test("Should return emails array", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("emails");
      expect(Array.isArray(result.emails)).toBe(true);
    });

    test("Should return phones array", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("phones");
      expect(Array.isArray(result.phones)).toBe(true);
    });

    test("Should have contact form detection", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasContactForm");
    });

    test("Should have WhatsApp widget detection", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasWhatsAppWidget");
    });

    test("Should have live chat detection", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasLiveChat");
    });

    test("Should have mobile responsive detection", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("isMobileResponsive");
    });

    test("Should have social media object", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("socialMedia");
    });
  });

  describe("enrichLead", () => {
    const mockLeadData = {
      businessName: "Test Restaurant",
      category: "Restaurant",
      googleRating: 4.5,
      reviewCount: 100,
      websiteUrl: "https://test-restaurant.com",
      phoneRaw: "+1234567890",
      location: "Buenos Aires",
    };

    test("Should enrich lead with website", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result).toHaveProperty("websiteAnalysis");
      expect(result).toHaveProperty("leadScore");
    });

    test("Should handle lead without website", async () => {
      const leadWithoutWebsite = {
        ...mockLeadData,
        websiteUrl: undefined,
      };

      const result = await enrichmentService.enrichLead(leadWithoutWebsite);

      expect(result).toHaveProperty("websiteAnalysis");
    });

    test("Should return enrichment metadata", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result).toHaveProperty("leadScore");
      expect(typeof result.leadScore).toBe("number");
    });

    test("Should calculate lead score", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result.leadScore).toBeGreaterThanOrEqual(0);
      expect(result.leadScore).toBeLessThanOrEqual(100);
    });

    test("Should return estimated revenue", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result).toHaveProperty("estimatedRevenue");
    });

    test("Should identify pain points", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result).toHaveProperty("painPoints");
      expect(Array.isArray(result.painPoints)).toBe(true);
    });

    test("Should identify opportunities", async () => {
      const result = await enrichmentService.enrichLead(mockLeadData);

      expect(result).toHaveProperty("opportunities");
      expect(Array.isArray(result.opportunities)).toBe(true);
    });
  });

  describe("URL normalization", () => {
    test("Should handle URL without protocol", async () => {
      const result = await enrichmentService.analyzeWebsite("example.com");
      expect(result).toHaveProperty("hasWebsite");
    });

    test("Should handle URL with http", async () => {
      const result = await enrichmentService.analyzeWebsite(
        "http://example.com"
      );
      expect(result).toHaveProperty("hasWebsite");
    });

    test("Should handle URL with https", async () => {
      const result = await enrichmentService.analyzeWebsite(
        "https://example.com"
      );
      expect(result).toHaveProperty("hasWebsite");
    });

    test("Should handle URL with www", async () => {
      const result = await enrichmentService.analyzeWebsite(
        "https://www.example.com"
      );
      expect(result).toHaveProperty("hasWebsite");
    });
  });

  describe("Website status detection", () => {
    test("Should return status property", async () => {
      const result = await enrichmentService.analyzeWebsite(
        "https://active-site.com"
      );
      expect(result).toHaveProperty("status");
    });

    test("Should have valid status value", async () => {
      const result = await enrichmentService.analyzeWebsite("https://site.com");
      expect(["active", "parked", "generic", "redirect", "error"]).toContain(
        result.status
      );
    });
  });

  describe("Contact extraction", () => {
    test("Should return phones array", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("phones");
      expect(Array.isArray(result.phones)).toBe(true);
    });

    test("Should return social media object", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("socialMedia");
      expect(typeof result.socialMedia).toBe("object");
    });
  });

  describe("Feature detection", () => {
    test("Should detect contact form", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasContactForm");
      expect(typeof result.hasContactForm).toBe("boolean");
    });

    test("Should detect WhatsApp widget", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasWhatsAppWidget");
      expect(typeof result.hasWhatsAppWidget).toBe("boolean");
    });

    test("Should detect live chat", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("hasLiveChat");
      expect(typeof result.hasLiveChat).toBe("boolean");
    });

    test("Should detect mobile responsive", async () => {
      const result = await enrichmentService.analyzeWebsite("https://test.com");
      expect(result).toHaveProperty("isMobileResponsive");
      expect(typeof result.isMobileResponsive).toBe("boolean");
    });
  });
});
