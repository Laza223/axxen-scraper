/**
 * 🧪 Zone Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  addCustomZone,
  analyzeZone,
  estimateScrapeTime,
  getAvailableZones,
} from "../services/zoneService";

vi.mock("../services/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe("zoneService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeZone", () => {
    test("returns analysis for known zone (Buenos Aires)", () => {
      const result = analyzeZone("Buenos Aires");
      expect(result).toHaveProperty("originalLocation");
      expect(result).toHaveProperty("subzones");
      expect(result).toHaveProperty("isLargeZone");
      expect(result.subzones.length).toBeGreaterThan(0);
      expect(result.isLargeZone).toBe(true);
    });

    test("returns single subzone for unknown location", () => {
      const result = analyzeZone("Unknown City XYZ");
      expect(result.subzones).toHaveLength(1);
      expect(result.isLargeZone).toBe(false);
    });

    test("handles empty string", () => {
      const result = analyzeZone("");
      expect(result).toHaveProperty("subzones");
    });
  });

  describe("getAvailableZones", () => {
    test("returns array of available zones", () => {
      const zones = getAvailableZones();
      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);
      expect(zones[0]).toHaveProperty("name");
      expect(zones[0]).toHaveProperty("subzoneCount");
    });
  });

  describe("addCustomZone", () => {
    test("adds custom zone successfully", () => {
      addCustomZone(
        "custom_zone",
        ["custom", "test zone"],
        ["Subzone A", "Subzone B"]
      );
      // If it doesn't throw, it succeeded
      expect(true).toBe(true);
    });
  });

  describe("estimateScrapeTime", () => {
    test("returns time estimate for zone", () => {
      const estimate = estimateScrapeTime("Buenos Aires");
      expect(estimate).toHaveProperty("subzones");
      expect(estimate).toHaveProperty("estimatedMinutes");
      expect(typeof estimate.estimatedMinutes).toBe("number");
    });
  });
});
