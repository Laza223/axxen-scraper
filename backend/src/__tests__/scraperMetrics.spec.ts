/**
 * 🧪 Scraper Metrics Tests (Optimized)
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { scraperMetrics } from "../services/scraperMetrics";

describe("scraperMetrics", () => {
  beforeEach(() => scraperMetrics.reset());
  afterEach(() => scraperMetrics.reset());

  describe("getMetrics", () => {
    test("returns metrics object with zero initial values", () => {
      const metrics = scraperMetrics.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe("recordRequest", () => {
    test("tracks total, successful, and failed requests", () => {
      scraperMetrics.recordRequest({ url: "a", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "b", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "c", success: false, duration: 100 });

      const m = scraperMetrics.getMetrics();
      expect(m.totalRequests).toBe(3);
      expect(m.successfulRequests).toBe(2);
      expect(m.failedRequests).toBe(1);
    });
  });

  describe("recordPlaceFound", () => {
    test("tracks places with phone and website", () => {
      scraperMetrics.recordPlaceFound({ phone: "+123" });
      scraperMetrics.recordPlaceFound({ website: "http://test.com" });
      scraperMetrics.recordPlaceFound({});

      const m = scraperMetrics.getMetrics();
      expect(m.totalPlacesFound).toBe(3);
      expect(m.placesWithPhone).toBe(1);
      expect(m.placesWithWebsite).toBe(1);
    });
  });

  describe("cache metrics", () => {
    test("tracks cache hits and misses", () => {
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheMiss();

      const m = scraperMetrics.getMetrics();
      expect(m.cacheHits).toBe(2);
      expect(m.cacheMisses).toBe(1);
    });

    test("calculates cache hit rate", () => {
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheMiss();
      scraperMetrics.recordCacheMiss();
      expect(scraperMetrics.getCacheHitRate()).toBe(50);
    });
  });

  describe("getSuccessRate", () => {
    test("returns 0 when no requests", () => {
      expect(scraperMetrics.getSuccessRate()).toBe(0);
    });

    test("returns 100 when all successful", () => {
      scraperMetrics.recordRequest({ url: "a", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "b", success: true, duration: 100 });
      expect(scraperMetrics.getSuccessRate()).toBe(100);
    });

    test("calculates mixed success rate", () => {
      scraperMetrics.recordRequest({ url: "a", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "b", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "c", success: true, duration: 100 });
      scraperMetrics.recordRequest({ url: "d", success: false, duration: 100 });
      expect(scraperMetrics.getSuccessRate()).toBe(75);
    });
  });

  describe("reset", () => {
    test("clears all metrics", () => {
      scraperMetrics.recordRequest({ url: "a", success: true, duration: 100 });
      scraperMetrics.recordPlaceFound({ phone: "+1" });
      scraperMetrics.recordCacheHit();
      scraperMetrics.reset();

      const m = scraperMetrics.getMetrics();
      expect(m.totalRequests).toBe(0);
      expect(m.totalPlacesFound).toBe(0);
      expect(m.cacheHits).toBe(0);
    });
  });
});
