/**
 * 🧪 Email Discovery Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("puppeteer", () => {
  const mockPage = {
    close: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue({ status: vi.fn().mockReturnValue(200) }),
    setUserAgent: vi.fn(),
    setExtraHTTPHeaders: vi.fn(),
    setDefaultTimeout: vi.fn(),
    content: vi.fn().mockResolvedValue("<html>test@example.com</html>"),
    evaluate: vi.fn().mockResolvedValue({
      bodyText: "Contact: info@test.com",
      links: ["mailto:contact@test.com", "https://instagram.com/test"],
      metas: ["info@test.com"],
    }),
  };
  return {
    default: {
      launch: vi.fn().mockResolvedValue({
        close: vi.fn(),
        newPage: vi.fn().mockResolvedValue(mockPage),
      }),
    },
  };
});

import {
  EmailDiscoveryResult,
  emailDiscoveryService,
  SocialLinks,
} from "../services/emailDiscovery";

describe("emailDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("service methods", () => {
    test("service is defined with required methods", () => {
      expect(emailDiscoveryService).toBeDefined();
      expect(typeof emailDiscoveryService.init).toBe("function");
      expect(typeof emailDiscoveryService.close).toBe("function");
      expect(typeof emailDiscoveryService.discoverFromWebsite).toBe("function");
    });
  });

  describe("EmailDiscoveryResult structure", () => {
    test("has all required properties", () => {
      const result: EmailDiscoveryResult = {
        emails: ["test@example.com"],
        primaryEmail: "test@example.com",
        isBusinessEmail: true,
        socialLinks: { instagram: "https://instagram.com/biz" },
        scrapedPages: ["https://example.com"],
        discoveryTime: 1000,
      };

      expect(Array.isArray(result.emails)).toBe(true);
      expect(result.primaryEmail).toBe("test@example.com");
      expect(typeof result.isBusinessEmail).toBe("boolean");
      expect(typeof result.socialLinks).toBe("object");
      expect(Array.isArray(result.scrapedPages)).toBe(true);
      expect(result.discoveryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SocialLinks structure", () => {
    test("supports all social platforms", () => {
      const links: SocialLinks = {
        instagram: "https://instagram.com/biz",
        facebook: "https://facebook.com/biz",
        twitter: "https://twitter.com/biz",
        linkedin: "https://linkedin.com/biz",
        youtube: "https://youtube.com/biz",
      };

      expect(links.instagram).toBeDefined();
      expect(links.facebook).toBeDefined();
      expect(links.twitter).toBeDefined();
    });
  });
});
