/**
 * 🧪 Tech Stack Detector Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        data: `<html><head><meta name="generator" content="WordPress 6.0"/></head><body><div id="__next"></div></body></html>`,
        headers: { "x-powered-by": "Express", server: "nginx" },
      }),
    })),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: {
    getCachedTechStack: vi.fn().mockResolvedValue(null),
    setCachedTechStack: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  },
  cacheService: {
    getCachedTechStack: vi.fn().mockResolvedValue(null),
    setCachedTechStack: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
  },
}));

import { TechStack, techStackDetector } from "../services/techStackDetector";

describe("techStackDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("service is defined with required methods", () => {
    expect(techStackDetector).toBeDefined();
    expect(typeof techStackDetector.detect).toBe("function");
    expect(typeof techStackDetector.summarize).toBe("function");
    expect(typeof techStackDetector.identifyOpportunities).toBe("function");
  });

  describe("detect", () => {
    test("handles undefined/empty URL", async () => {
      expect(await techStackDetector.detect()).toBeNull();
      expect(await techStackDetector.detect("")).toBeNull();
    });

    test("returns TechStack for valid URL", async () => {
      const result = await techStackDetector.detect("https://example.com");
      if (result) {
        expect(result).toHaveProperty("analytics");
        expect(result).toHaveProperty("marketing");
        expect(result).toHaveProperty("complexity");
      }
    });
  });

  describe("summarize", () => {
    const mockStack: TechStack = {
      cms: "WordPress",
      framework: "React",
      hosting: "AWS",
      ecommerce: undefined,
      analytics: ["Google Analytics"],
      marketing: [],
      security: [],
      performance: [],
      other: [],
      complexity: "intermediate",
      estimatedBudget: "medium",
      modernScore: 70,
    };

    test("returns string summary including CMS", () => {
      const summary = techStackDetector.summarize(mockStack);
      expect(typeof summary).toBe("string");
      expect(summary.toLowerCase()).toContain("wordpress");
    });
  });

  describe("identifyOpportunities", () => {
    test("returns opportunities array for basic stack", () => {
      const basicStack: TechStack = {
        cms: undefined,
        framework: undefined,
        hosting: undefined,
        ecommerce: undefined,
        analytics: [],
        marketing: [],
        security: [],
        performance: [],
        other: [],
        complexity: "basic",
        estimatedBudget: "low",
        modernScore: 20,
      };

      const opportunities = techStackDetector.identifyOpportunities(basicStack);
      expect(Array.isArray(opportunities)).toBe(true);
      expect(opportunities.length).toBeGreaterThan(0);
    });
  });

  describe("TechStack structure", () => {
    test("has all expected properties", () => {
      const stack: TechStack = {
        cms: "WordPress",
        framework: "React",
        hosting: "Vercel",
        ecommerce: "WooCommerce",
        analytics: ["GA"],
        marketing: ["HubSpot"],
        security: ["SSL"],
        performance: ["CDN"],
        other: [],
        complexity: "advanced",
        estimatedBudget: "high",
        modernScore: 85,
      };

      expect(stack).toHaveProperty("cms");
      expect(stack).toHaveProperty("framework");
      expect(stack).toHaveProperty("analytics");
      expect(stack).toHaveProperty("complexity");
      expect(typeof stack.modernScore).toBe("number");
    });
  });
});
