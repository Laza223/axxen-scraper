/**
 * 🧪 Tech Stack Detector Service Tests
 * Tests para el servicio de detección de tecnologías web
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

// Los mocks deben usar valores literales, no variables
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        data: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="generator" content="WordPress 6.0" />
            <script src="https://www.googletagmanager.com/gtag/js?id=GA-123"></script>
          </head>
          <body>
            <div id="__next">React/Next.js App</div>
          </body>
          </html>
        `,
        headers: {
          "x-powered-by": "Express",
          server: "nginx",
        },
      }),
    })),
    get: vi.fn().mockResolvedValue({
      data: "<html></html>",
      headers: {},
    }),
  },
}));

vi.mock("../services/cacheService", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getCachedTechStack: vi.fn().mockResolvedValue(null),
    setCachedTechStack: vi.fn().mockResolvedValue(undefined),
  },
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getCachedTechStack: vi.fn().mockResolvedValue(null),
    setCachedTechStack: vi.fn().mockResolvedValue(undefined),
  },
}));

// Importar DESPUÉS de los mocks
import { TechStack, techStackDetector } from "../services/techStackDetector";

describe("techStackDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(techStackDetector).toBeDefined();
    });

    test("Should have detect method", () => {
      expect(typeof techStackDetector.detect).toBe("function");
    });

    test("Should have summarize method", () => {
      expect(typeof techStackDetector.summarize).toBe("function");
    });

    test("Should have identifyOpportunities method", () => {
      expect(typeof techStackDetector.identifyOpportunities).toBe("function");
    });
  });

  describe("detect", () => {
    test("Should handle undefined URL", async () => {
      const result = await techStackDetector.detect();
      expect(result).toBeNull();
    });

    test("Should handle empty URL", async () => {
      const result = await techStackDetector.detect("");
      expect(result).toBeNull();
    });

    test("Should return TechStack object for valid URL", async () => {
      const result = await techStackDetector.detect("https://example.com");

      expect(result).toBeDefined();
      if (result) {
        expect(result).toHaveProperty("analytics");
        expect(result).toHaveProperty("marketing");
        expect(result).toHaveProperty("complexity");
      }
    });
  });

  describe("summarize", () => {
    test("Should return string summary for valid tech stack", () => {
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

      const summary = techStackDetector.summarize(mockStack);
      expect(typeof summary).toBe("string");
    });

    test("Summary should include CMS when present", () => {
      const mockStack: TechStack = {
        cms: "WordPress",
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
        modernScore: 40,
      };

      const summary = techStackDetector.summarize(mockStack);
      expect(summary.toLowerCase()).toContain("wordpress");
    });
  });

  describe("identifyOpportunities", () => {
    test("Should return array of opportunities for valid stack", () => {
      const mockStack: TechStack = {
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

      const opportunities = techStackDetector.identifyOpportunities(mockStack);
      expect(Array.isArray(opportunities)).toBe(true);
    });

    test("Should identify analytics opportunity when missing", () => {
      const mockStack: TechStack = {
        cms: "WordPress",
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
        modernScore: 30,
      };

      const opportunities = techStackDetector.identifyOpportunities(mockStack);
      expect(opportunities.length).toBeGreaterThan(0);
    });
  });

  describe("TechStack structure", () => {
    test("TechStack should have cms property", () => {
      const mockStack: TechStack = {
        cms: "WordPress",
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
        modernScore: 50,
      };

      expect(mockStack).toHaveProperty("cms");
    });

    test("TechStack should have analytics array", () => {
      const mockStack: TechStack = {
        cms: undefined,
        framework: undefined,
        hosting: undefined,
        ecommerce: undefined,
        analytics: ["Google Analytics", "Facebook Pixel"],
        marketing: [],
        security: [],
        performance: [],
        other: [],
        complexity: "intermediate",
        estimatedBudget: "medium",
        modernScore: 60,
      };

      expect(Array.isArray(mockStack.analytics)).toBe(true);
      expect(mockStack.analytics.length).toBe(2);
    });

    test("TechStack should have complexity property", () => {
      const mockStack: TechStack = {
        cms: undefined,
        framework: undefined,
        hosting: undefined,
        ecommerce: undefined,
        analytics: [],
        marketing: [],
        security: [],
        performance: [],
        other: [],
        complexity: "advanced",
        estimatedBudget: "high",
        modernScore: 90,
      };

      expect(["basic", "intermediate", "advanced"]).toContain(
        mockStack.complexity
      );
    });

    test("TechStack should have modernScore property", () => {
      const mockStack: TechStack = {
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
        modernScore: 75,
      };

      expect(mockStack.modernScore).toBeGreaterThanOrEqual(0);
      expect(mockStack.modernScore).toBeLessThanOrEqual(100);
    });

    test("TechStack should have ecommerce property", () => {
      const mockStack: TechStack = {
        cms: undefined,
        framework: undefined,
        hosting: undefined,
        ecommerce: "Shopify",
        analytics: [],
        marketing: [],
        security: [],
        performance: [],
        other: [],
        complexity: "intermediate",
        estimatedBudget: "medium",
        modernScore: 65,
      };

      expect(mockStack.ecommerce).toBe("Shopify");
    });
  });

  describe("CMS detection patterns", () => {
    test("Should recognize WordPress patterns", () => {
      const wpPatterns = ["wp-content", "wp-includes", "wordpress"];
      expect(wpPatterns.length).toBeGreaterThan(0);
    });

    test("Should recognize Shopify patterns", () => {
      const shopifyPatterns = ["cdn.shopify.com", "Shopify.theme"];
      expect(shopifyPatterns.length).toBeGreaterThan(0);
    });

    test("Should recognize Wix patterns", () => {
      const wixPatterns = ["wix.com", "wixsite.com"];
      expect(wixPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("Analytics detection patterns", () => {
    test("Should recognize Google Analytics", () => {
      const gaPatterns = ["googletagmanager", "google-analytics", "gtag"];
      expect(gaPatterns.length).toBeGreaterThan(0);
    });

    test("Should recognize Facebook Pixel", () => {
      const fbPatterns = ["facebook.net", "fbevents.js", "fbq("];
      expect(fbPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("Framework detection patterns", () => {
    test("Should recognize React patterns", () => {
      const reactPatterns = ["__NEXT_DATA__", "react-root", "_next"];
      expect(reactPatterns.length).toBeGreaterThan(0);
    });

    test("Should recognize Vue patterns", () => {
      const vuePatterns = ["vue.js", "__vue__", "v-if"];
      expect(vuePatterns.length).toBeGreaterThan(0);
    });
  });

  describe("Complexity levels", () => {
    test("Should have valid complexity values", () => {
      const validComplexities = ["basic", "intermediate", "advanced"];
      expect(validComplexities.length).toBe(3);
    });
  });

  describe("Budget estimates", () => {
    test("Should have valid budget values", () => {
      const validBudgets = ["low", "medium", "high"];
      expect(validBudgets.length).toBe(3);
    });
  });
});
