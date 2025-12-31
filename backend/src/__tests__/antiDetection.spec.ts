/**
 * 🧪 Anti-Detection Service Tests
 */

import { describe, expect, test } from "vitest";
import {
  formatProxyForPuppeteer,
  getClickDelay,
  getLongPauseDelay,
  getNavigationDelay,
  getRandomHeaders,
  getRandomLanguage,
  getRandomMouseMovement,
  getRandomProxy,
  getRandomResolution,
  getRandomUserAgent,
  getScrollDelay,
  getTypingDelay,
  humanDelay,
  PROXY_LIST,
  shouldTakeLongPause,
  USER_AGENTS,
} from "../services/antiDetection";

describe("antiDetection", () => {
  test("getRandomUserAgent returns valid user agent from list", () => {
    const ua = getRandomUserAgent();
    expect(USER_AGENTS).toContain(ua);
    expect(ua).toContain("Mozilla/5.0");
  });

  test("getRandomResolution returns valid desktop dimensions", () => {
    const res = getRandomResolution();
    expect(res.width).toBeGreaterThanOrEqual(1024);
    expect(res.height).toBeGreaterThanOrEqual(720);
  });

  test("getRandomLanguage returns Spanish variant", () => {
    expect(getRandomLanguage()).toMatch(/es-[A-Z]{2}/);
  });

  test("humanDelay returns value within range", () => {
    const delay = humanDelay(100, 200);
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(200);
  });

  test("humanDelay uses defaults (500-2000ms)", () => {
    const delay = humanDelay();
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(2000);
  });

  test("getTypingDelay returns 50-150ms", () => {
    const delay = getTypingDelay();
    expect(delay).toBeGreaterThanOrEqual(50);
    expect(delay).toBeLessThanOrEqual(150);
  });

  test("getScrollDelay returns 500-1500ms", () => {
    const delay = getScrollDelay();
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1500);
  });

  test("getRandomHeaders includes required headers", () => {
    const headers = getRandomHeaders();
    expect(headers).toHaveProperty("Accept-Language");
    expect(headers).toHaveProperty("Accept");
    expect(headers).toHaveProperty("Sec-Ch-Ua");
    expect(headers["Upgrade-Insecure-Requests"]).toBe("1");
  });

  test("getRandomMouseMovement returns x,y in valid range", () => {
    const m = getRandomMouseMovement();
    expect(m.x).toBeGreaterThanOrEqual(-50);
    expect(m.x).toBeLessThanOrEqual(50);
    expect(m.y).toBeGreaterThanOrEqual(-50);
    expect(m.y).toBeLessThanOrEqual(50);
  });

  test("getClickDelay returns 200-800ms", () => {
    const delay = getClickDelay();
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThanOrEqual(800);
  });

  test("getNavigationDelay returns 1-3 seconds", () => {
    const delay = getNavigationDelay();
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(3000);
  });

  test("shouldTakeLongPause returns boolean", () => {
    expect(typeof shouldTakeLongPause()).toBe("boolean");
  });

  test("getLongPauseDelay returns 5-15 seconds", () => {
    const delay = getLongPauseDelay();
    expect(delay).toBeGreaterThanOrEqual(5000);
    expect(delay).toBeLessThanOrEqual(15000);
  });

  test("getRandomProxy returns null when PROXY_LIST empty", () => {
    if (PROXY_LIST.length === 0) {
      expect(getRandomProxy()).toBeNull();
    }
  });

  test("formatProxyForPuppeteer formats correctly", () => {
    expect(formatProxyForPuppeteer({ host: "proxy.com", port: 8080 })).toBe(
      "http://proxy.com:8080"
    );
  });
});
