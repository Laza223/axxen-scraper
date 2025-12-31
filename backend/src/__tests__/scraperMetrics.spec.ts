/**
 * 🧪 Scraper Metrics Service Tests
 * Tests para el servicio de métricas del scraper
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { scraperMetrics } from "../services/scraperMetrics";

describe("scraperMetrics", () => {
  beforeEach(() => {
    scraperMetrics.reset();
  });

  afterEach(() => {
    scraperMetrics.reset();
  });

  describe("getMetrics", () => {
    test("Should return metrics object", () => {
      const metrics = scraperMetrics.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty("totalRequests");
      expect(metrics).toHaveProperty("successfulRequests");
      expect(metrics).toHaveProperty("failedRequests");
    });

    test("Should initialize with zero values", () => {
      const metrics = scraperMetrics.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe("recordRequest", () => {
    test("Should increment total requests", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });

      expect(scraperMetrics.getMetrics().totalRequests).toBe(3);
    });

    test("Should track successful requests", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });

      expect(scraperMetrics.getMetrics().successfulRequests).toBe(2);
    });

    test("Should track failed requests", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });

      expect(scraperMetrics.getMetrics().failedRequests).toBe(3);
    });

    test("Should calculate success rate", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });

      const successRate = scraperMetrics.getSuccessRate();

      expect(successRate).toBe(75);
    });
  });

  describe("recordPlaceFound", () => {
    test("Should track total places scraped", () => {
      scraperMetrics.recordPlaceFound({ phone: "+123" });
      scraperMetrics.recordPlaceFound({ website: "http://test.com" });
      scraperMetrics.recordPlaceFound({});

      expect(scraperMetrics.getMetrics().totalPlacesFound).toBe(3);
    });

    test("Should track places with phone", () => {
      scraperMetrics.recordPlaceFound({ phone: "+123" });
      scraperMetrics.recordPlaceFound({ phone: "+456" });
      scraperMetrics.recordPlaceFound({});

      expect(scraperMetrics.getMetrics().placesWithPhone).toBe(2);
    });

    test("Should track places with website", () => {
      scraperMetrics.recordPlaceFound({ website: "http://test.com" });
      scraperMetrics.recordPlaceFound({});

      expect(scraperMetrics.getMetrics().placesWithWebsite).toBe(1);
    });
  });

  describe("recordCacheHit and recordCacheMiss", () => {
    test("Should track cache hits", () => {
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheHit();

      expect(scraperMetrics.getMetrics().cacheHits).toBe(2);
    });

    test("Should track cache misses", () => {
      scraperMetrics.recordCacheMiss();
      scraperMetrics.recordCacheMiss();
      scraperMetrics.recordCacheMiss();

      expect(scraperMetrics.getMetrics().cacheMisses).toBe(3);
    });

    test("Should calculate cache hit rate", () => {
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheHit();
      scraperMetrics.recordCacheMiss();
      scraperMetrics.recordCacheMiss();

      const hitRate = scraperMetrics.getCacheHitRate();

      expect(hitRate).toBe(50);
    });
  });

  describe("getSuccessRate", () => {
    test("Should return 0 when no requests", () => {
      expect(scraperMetrics.getSuccessRate()).toBe(0);
    });

    test("Should return 100 when all successful", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });

      expect(scraperMetrics.getSuccessRate()).toBe(100);
    });

    test("Should return 0 when all failed", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });

      expect(scraperMetrics.getSuccessRate()).toBe(0);
    });
  });

  describe("getBlockRate", () => {
    test("Should calculate block rate", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
        blocked: true,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
        blocked: true,
      });

      const blockRate = scraperMetrics.getBlockRate();

      expect(blockRate).toBeCloseTo(66.67, 1);
    });
  });

  describe("reset", () => {
    test("Should reset all metrics to zero", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: false,
        duration: 100,
      });
      scraperMetrics.recordPlaceFound({ phone: "+123" });

      scraperMetrics.reset();

      const metrics = scraperMetrics.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.totalPlacesFound).toBe(0);
    });

    test("Should clear request history", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });

      scraperMetrics.reset();

      const history = scraperMetrics.getRequestHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe("getRequestHistory", () => {
    test("Should return request history", () => {
      scraperMetrics.recordRequest({
        url: "test1",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test2",
        success: true,
        duration: 200,
      });

      const history = scraperMetrics.getRequestHistory();

      expect(history).toHaveLength(2);
    });

    test("Should limit history by count", () => {
      scraperMetrics.recordRequest({
        url: "test1",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test2",
        success: true,
        duration: 200,
      });
      scraperMetrics.recordRequest({
        url: "test3",
        success: true,
        duration: 300,
      });

      const history = scraperMetrics.getRequestHistory(2);

      expect(history).toHaveLength(2);
    });
  });

  describe("getDataQualityStats", () => {
    test("Should return quality statistics", () => {
      scraperMetrics.recordPlaceFound({
        phone: "+123",
        website: "http://test.com",
      });
      scraperMetrics.recordPlaceFound({ phone: "+456" });
      scraperMetrics.recordPlaceFound({});

      const stats = scraperMetrics.getDataQualityStats();

      expect(stats).toHaveProperty("phoneRate");
      expect(stats).toHaveProperty("websiteRate");
    });
  });

  describe("exportToJSON", () => {
    test("Should export metrics as JSON string", () => {
      scraperMetrics.recordRequest({
        url: "test",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordPlaceFound({ phone: "+123" });

      const json = scraperMetrics.exportToJSON();

      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty("metrics");
      expect(parsed).toHaveProperty("successRate");
    });
  });

  describe("timing metrics", () => {
    test("Should track fastest request", () => {
      scraperMetrics.recordRequest({
        url: "test1",
        success: true,
        duration: 200,
      });
      scraperMetrics.recordRequest({
        url: "test2",
        success: true,
        duration: 50,
      });
      scraperMetrics.recordRequest({
        url: "test3",
        success: true,
        duration: 150,
      });

      expect(scraperMetrics.getMetrics().fastestRequest).toBe(50);
    });

    test("Should track slowest request", () => {
      scraperMetrics.recordRequest({
        url: "test1",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test2",
        success: true,
        duration: 300,
      });
      scraperMetrics.recordRequest({
        url: "test3",
        success: true,
        duration: 150,
      });

      expect(scraperMetrics.getMetrics().slowestRequest).toBe(300);
    });

    test("Should calculate average request time", () => {
      scraperMetrics.recordRequest({
        url: "test1",
        success: true,
        duration: 100,
      });
      scraperMetrics.recordRequest({
        url: "test2",
        success: true,
        duration: 200,
      });

      expect(scraperMetrics.getMetrics().averageRequestTime).toBe(150);
    });
  });
});
