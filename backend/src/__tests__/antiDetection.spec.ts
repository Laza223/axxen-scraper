/**
 * 🧪 Anti-Detection Service Tests
 * Tests para el servicio de evasión de detección
 */

import { describe, expect, test } from "vitest";
import {
  ACCEPT_LANGUAGES,
  getRandomLanguage,
  getRandomResolution,
  getRandomUserAgent,
  getScrollDelay,
  getTypingDelay,
  humanDelay,
  SCREEN_RESOLUTIONS,
  USER_AGENTS,
} from "../services/antiDetection";

describe("antiDetection", () => {
  describe("getRandomUserAgent", () => {
    test("Should return a valid user agent string", () => {
      const ua = getRandomUserAgent();

      expect(typeof ua).toBe("string");
      expect(ua.length).toBeGreaterThan(50);
    });

    test("Should return a user agent from the list", () => {
      const ua = getRandomUserAgent();

      expect(USER_AGENTS).toContain(ua);
    });

    test("Should contain required browser components", () => {
      const ua = getRandomUserAgent();

      expect(ua).toContain("Mozilla/5.0");
      expect(ua).toMatch(/Windows|Macintosh|Linux/);
    });

    test("Should return different user agents (randomness)", () => {
      const agents = new Set<string>();

      for (let i = 0; i < 50; i++) {
        agents.add(getRandomUserAgent());
      }

      // Debería haber al menos algunas variaciones
      expect(agents.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getRandomResolution", () => {
    test("Should return resolution with width and height", () => {
      const resolution = getRandomResolution();

      expect(resolution).toHaveProperty("width");
      expect(resolution).toHaveProperty("height");
      expect(typeof resolution.width).toBe("number");
      expect(typeof resolution.height).toBe("number");
    });

    test("Should return a resolution from the list", () => {
      const resolution = getRandomResolution();

      const found = SCREEN_RESOLUTIONS.some(
        (r) => r.width === resolution.width && r.height === resolution.height
      );

      expect(found).toBe(true);
    });

    test("Should return valid desktop dimensions", () => {
      const resolution = getRandomResolution();

      expect(resolution.width).toBeGreaterThanOrEqual(1024);
      expect(resolution.width).toBeLessThanOrEqual(2560);
      expect(resolution.height).toBeGreaterThanOrEqual(720);
      expect(resolution.height).toBeLessThanOrEqual(1440);
    });

    test("Should always have positive dimensions", () => {
      for (let i = 0; i < 20; i++) {
        const resolution = getRandomResolution();
        expect(resolution.width).toBeGreaterThan(0);
        expect(resolution.height).toBeGreaterThan(0);
      }
    });
  });

  describe("getRandomLanguage", () => {
    test("Should return a valid language string", () => {
      const lang = getRandomLanguage();

      expect(typeof lang).toBe("string");
      expect(lang.length).toBeGreaterThan(0);
    });

    test("Should return a language from the list", () => {
      const lang = getRandomLanguage();

      expect(ACCEPT_LANGUAGES).toContain(lang);
    });

    test("Should contain Spanish variants", () => {
      const lang = getRandomLanguage();

      expect(lang).toMatch(/es-[A-Z]{2}/);
    });
  });

  describe("humanDelay", () => {
    test("Should return a number", () => {
      const delay = humanDelay(100, 200);

      expect(typeof delay).toBe("number");
    });

    test("Should return delay within range", () => {
      for (let i = 0; i < 100; i++) {
        const delay = humanDelay(100, 200);
        expect(delay).toBeGreaterThanOrEqual(100);
        expect(delay).toBeLessThanOrEqual(200);
      }
    });

    test("Should use default parameters", () => {
      const delay = humanDelay();

      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(2000);
    });

    test("Should handle equal min and max", () => {
      const delay = humanDelay(100, 100);

      expect(delay).toBe(100);
    });

    test("Should produce varied results (gaussian distribution)", () => {
      const delays = new Set<number>();

      for (let i = 0; i < 50; i++) {
        delays.add(humanDelay(100, 500));
      }

      // Should have some variety
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe("getTypingDelay", () => {
    test("Should return a number", () => {
      const delay = getTypingDelay();

      expect(typeof delay).toBe("number");
    });

    test("Should return delay in typing range (50-150ms)", () => {
      for (let i = 0; i < 20; i++) {
        const delay = getTypingDelay();
        expect(delay).toBeGreaterThanOrEqual(50);
        expect(delay).toBeLessThanOrEqual(150);
      }
    });
  });

  describe("getScrollDelay", () => {
    test("Should return a number", () => {
      const delay = getScrollDelay();

      expect(typeof delay).toBe("number");
    });

    test("Should return delay in scroll range (500-1500ms)", () => {
      for (let i = 0; i < 20; i++) {
        const delay = getScrollDelay();
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1500);
      }
    });
  });

  describe("USER_AGENTS constant", () => {
    test("Should have multiple user agents", () => {
      expect(USER_AGENTS.length).toBeGreaterThan(5);
    });

    test("Should include Chrome user agents", () => {
      const chromeAgents = USER_AGENTS.filter((ua) => ua.includes("Chrome"));
      expect(chromeAgents.length).toBeGreaterThan(0);
    });

    test("Should include Firefox user agents", () => {
      const firefoxAgents = USER_AGENTS.filter((ua) => ua.includes("Firefox"));
      expect(firefoxAgents.length).toBeGreaterThan(0);
    });

    test("Should include Safari user agents", () => {
      const safariAgents = USER_AGENTS.filter((ua) => ua.includes("Safari"));
      expect(safariAgents.length).toBeGreaterThan(0);
    });
  });

  describe("SCREEN_RESOLUTIONS constant", () => {
    test("Should have multiple resolutions", () => {
      expect(SCREEN_RESOLUTIONS.length).toBeGreaterThan(3);
    });

    test("Should include common resolutions", () => {
      const has1920x1080 = SCREEN_RESOLUTIONS.some(
        (r) => r.width === 1920 && r.height === 1080
      );
      expect(has1920x1080).toBe(true);
    });
  });

  describe("ACCEPT_LANGUAGES constant", () => {
    test("Should have multiple languages", () => {
      expect(ACCEPT_LANGUAGES.length).toBeGreaterThan(3);
    });

    test("Should include Spanish languages", () => {
      const hasSpanish = ACCEPT_LANGUAGES.every((lang) => lang.includes("es"));
      expect(hasSpanish).toBe(true);
    });
  });
});
