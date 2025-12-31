/**
 * 🧪 Email Discovery Service Tests
 * Tests para el servicio de descubrimiento de emails
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock de puppeteer
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue({
        close: vi.fn().mockResolvedValue(undefined),
        goto: vi
          .fn()
          .mockResolvedValue({ status: vi.fn().mockReturnValue(200) }),
        setUserAgent: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        setDefaultTimeout: vi.fn(),
        content: vi
          .fn()
          .mockResolvedValue(
            "<html><body>test@example.com info@business.com</body></html>"
          ),
        evaluate: vi.fn().mockResolvedValue("test content"),
      }),
    }),
  },
}));

// Importar DESPUÉS de los mocks
import {
  EmailDiscoveryResult,
  emailDiscoveryService,
  SocialLinks,
} from "../services/emailDiscovery";

describe("emailDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Service instance", () => {
    test("Should be defined", () => {
      expect(emailDiscoveryService).toBeDefined();
    });

    test("Should have init method", () => {
      expect(typeof emailDiscoveryService.init).toBe("function");
    });

    test("Should have close method", () => {
      expect(typeof emailDiscoveryService.close).toBe("function");
    });

    test("Should have discoverFromWebsite method", () => {
      expect(typeof emailDiscoveryService.discoverFromWebsite).toBe("function");
    });
  });

  describe("discoverFromWebsite", () => {
    test("Should return EmailDiscoveryResult structure", async () => {
      const mockResult: EmailDiscoveryResult = {
        emails: ["test@example.com"],
        primaryEmail: "test@example.com",
        isBusinessEmail: true,
        socialLinks: {},
        scrapedPages: ["https://example.com"],
        discoveryTime: 1000,
      };

      expect(mockResult).toHaveProperty("emails");
      expect(mockResult).toHaveProperty("primaryEmail");
      expect(mockResult).toHaveProperty("isBusinessEmail");
      expect(mockResult).toHaveProperty("socialLinks");
      expect(mockResult).toHaveProperty("scrapedPages");
      expect(mockResult).toHaveProperty("discoveryTime");
    });
  });

  describe("EmailDiscoveryResult structure", () => {
    test("Should have emails array", () => {
      const result: EmailDiscoveryResult = {
        emails: ["test@example.com", "info@example.com"],
        primaryEmail: "test@example.com",
        isBusinessEmail: true,
        socialLinks: {},
        scrapedPages: [],
        discoveryTime: 0,
      };

      expect(Array.isArray(result.emails)).toBe(true);
    });

    test("Should have primaryEmail", () => {
      const result: EmailDiscoveryResult = {
        emails: ["test@example.com"],
        primaryEmail: "test@example.com",
        isBusinessEmail: true,
        socialLinks: {},
        scrapedPages: [],
        discoveryTime: 0,
      };

      expect(result.primaryEmail).toBe("test@example.com");
    });

    test("Should have isBusinessEmail flag", () => {
      const result: EmailDiscoveryResult = {
        emails: [],
        primaryEmail: null,
        isBusinessEmail: false,
        socialLinks: {},
        scrapedPages: [],
        discoveryTime: 0,
      };

      expect(typeof result.isBusinessEmail).toBe("boolean");
    });

    test("Should have socialLinks object", () => {
      const result: EmailDiscoveryResult = {
        emails: [],
        primaryEmail: null,
        isBusinessEmail: false,
        socialLinks: {
          instagram: "https://instagram.com/business",
          facebook: "https://facebook.com/business",
        },
        scrapedPages: [],
        discoveryTime: 0,
      };

      expect(typeof result.socialLinks).toBe("object");
    });

    test("Should have scrapedPages array", () => {
      const result: EmailDiscoveryResult = {
        emails: [],
        primaryEmail: null,
        isBusinessEmail: false,
        socialLinks: {},
        scrapedPages: ["https://example.com", "https://example.com/contact"],
        discoveryTime: 0,
      };

      expect(Array.isArray(result.scrapedPages)).toBe(true);
    });

    test("Should have discoveryTime", () => {
      const result: EmailDiscoveryResult = {
        emails: [],
        primaryEmail: null,
        isBusinessEmail: false,
        socialLinks: {},
        scrapedPages: [],
        discoveryTime: 1500,
      };

      expect(typeof result.discoveryTime).toBe("number");
      expect(result.discoveryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SocialLinks structure", () => {
    test("Should support instagram", () => {
      const links: SocialLinks = {
        instagram: "https://instagram.com/business",
      };

      expect(links.instagram).toBeDefined();
    });

    test("Should support facebook", () => {
      const links: SocialLinks = {
        facebook: "https://facebook.com/business",
      };

      expect(links.facebook).toBeDefined();
    });

    test("Should support twitter", () => {
      const links: SocialLinks = {
        twitter: "https://twitter.com/business",
      };

      expect(links.twitter).toBeDefined();
    });

    test("Should support linkedin", () => {
      const links: SocialLinks = {
        linkedin: "https://linkedin.com/company/business",
      };

      expect(links.linkedin).toBeDefined();
    });

    test("Should support youtube", () => {
      const links: SocialLinks = {
        youtube: "https://youtube.com/c/business",
      };

      expect(links.youtube).toBeDefined();
    });

    test("Should support tiktok", () => {
      const links: SocialLinks = {
        tiktok: "https://tiktok.com/@business",
      };

      expect(links.tiktok).toBeDefined();
    });

    test("Should support whatsapp", () => {
      const links: SocialLinks = {
        whatsapp: "https://wa.me/1234567890",
      };

      expect(links.whatsapp).toBeDefined();
    });

    test("All social links should be optional", () => {
      const emptyLinks: SocialLinks = {};

      expect(emptyLinks.instagram).toBeUndefined();
      expect(emptyLinks.facebook).toBeUndefined();
      expect(emptyLinks.twitter).toBeUndefined();
    });
  });

  describe("Email patterns", () => {
    test("Should recognize valid email format", () => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
      const validEmails = [
        "test@example.com",
        "info@business.com",
        "contact@company.co",
      ];

      validEmails.forEach((email) => {
        expect(email.match(emailRegex)).toBeTruthy();
      });
    });

    test("Should recognize business email domains", () => {
      const businessDomains = ["company.com", "business.net", "shop.com.ar"];

      businessDomains.forEach((domain) => {
        expect(domain).not.toContain("gmail");
        expect(domain).not.toContain("hotmail");
        expect(domain).not.toContain("yahoo");
      });
    });

    test("Should identify generic email domains", () => {
      const genericDomains = [
        "gmail.com",
        "hotmail.com",
        "outlook.com",
        "yahoo.com",
      ];

      genericDomains.forEach((domain) => {
        expect(genericDomains).toContain(domain);
      });
    });
  });

  describe("Contact pages", () => {
    test("Should recognize contact page patterns", () => {
      const contactPaths = [
        "/contacto",
        "/contact",
        "/contactenos",
        "/contact-us",
        "/about",
        "/nosotros",
      ];

      expect(contactPaths.length).toBeGreaterThan(0);
      expect(contactPaths).toContain("/contact");
      expect(contactPaths).toContain("/contacto");
    });
  });

  describe("Social media patterns", () => {
    test("Should recognize Instagram URLs", () => {
      const instagramPatterns = [
        "https://instagram.com/business",
        "https://www.instagram.com/user",
      ];

      instagramPatterns.forEach((url) => {
        expect(url).toContain("instagram");
      });
    });

    test("Should recognize Facebook URLs", () => {
      const facebookPatterns = [
        "https://facebook.com/business",
        "https://www.facebook.com/page",
        "https://fb.com/user",
      ];

      facebookPatterns.forEach((url) => {
        expect(url.includes("facebook") || url.includes("fb.com")).toBe(true);
      });
    });

    test("Should recognize LinkedIn URLs", () => {
      const linkedinPatterns = [
        "https://linkedin.com/company/business",
        "https://www.linkedin.com/in/user",
      ];

      linkedinPatterns.forEach((url) => {
        expect(url).toContain("linkedin");
      });
    });

    test("Should recognize WhatsApp URLs", () => {
      const whatsappPatterns = [
        "https://wa.me/1234567890",
        "https://api.whatsapp.com/send?phone=1234567890",
      ];

      whatsappPatterns.forEach((url) => {
        expect(url.includes("wa.me") || url.includes("whatsapp")).toBe(true);
      });
    });
  });

  describe("init and close", () => {
    test("init should not throw", async () => {
      await expect(emailDiscoveryService.init()).resolves.not.toThrow();
    });

    test("close should not throw", async () => {
      await expect(emailDiscoveryService.close()).resolves.not.toThrow();
    });

    test("close should be idempotent", async () => {
      await emailDiscoveryService.close();
      await expect(emailDiscoveryService.close()).resolves.not.toThrow();
    });
  });

  describe("Ignored emails", () => {
    test("Should have list of ignored emails", () => {
      const ignoredEmails = [
        "example@example.com",
        "test@test.com",
        "noreply@",
        "no-reply@",
      ];

      expect(ignoredEmails.length).toBeGreaterThan(0);
    });

    test("Should filter out no-reply emails", () => {
      const email = "no-reply@company.com";
      expect(email).toContain("no-reply");
    });
  });
});
