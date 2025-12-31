/**
 * 🧪 Zone Service Tests
 * Tests para el servicio de zonas geográficas
 */

import { describe, expect, test } from "vitest";
import {
  addCustomZone,
  analyzeZone,
  estimateScrapeTime,
  getAvailableZones,
} from "../services/zoneService";

describe("zoneService", () => {
  describe("analyzeZone", () => {
    describe("Zonas grandes conocidas", () => {
      test("Given 'Buenos Aires', should return isLargeZone=true with subzones", () => {
        const result = analyzeZone("Buenos Aires");

        expect(result.isLargeZone).toBe(true);
        expect(result.originalLocation).toBe("Buenos Aires");
        expect(result.subzones.length).toBeGreaterThan(10);
        expect(result.zoneName).toBe("buenos_aires");
        expect(result.country).toBe("Argentina");
        expect(result.subzones).toContain("Palermo, Buenos Aires");
        expect(result.subzones).toContain("Belgrano, Buenos Aires");
      });

      test("Given 'buenos aires' (lowercase), should detect as large zone", () => {
        const result = analyzeZone("buenos aires");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("buenos_aires");
      });

      test("Given 'CABA', should detect as Buenos Aires", () => {
        const result = analyzeZone("CABA");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("buenos_aires");
      });

      test("Given 'Capital Federal', should detect as Buenos Aires", () => {
        const result = analyzeZone("Capital Federal");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("buenos_aires");
      });

      test("Given 'Buenos Aires, Argentina', should detect as large zone", () => {
        const result = analyzeZone("Buenos Aires, Argentina");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("buenos_aires");
      });

      test("Given 'Córdoba', should return Córdoba subzones", () => {
        const result = analyzeZone("Córdoba");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("cordoba");
        expect(result.country).toBe("Argentina");
        expect(result.subzones).toContain("Nueva Córdoba, Córdoba");
      });

      test("Given 'CDMX', should return Mexico City subzones", () => {
        const result = analyzeZone("CDMX");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("cdmx");
        expect(result.country).toBe("México");
      });

      test("Given 'Ciudad de México', should detect as CDMX", () => {
        const result = analyzeZone("Ciudad de México");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("cdmx");
      });

      test("Given 'Madrid', should return Madrid subzones", () => {
        const result = analyzeZone("Madrid");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("madrid");
        expect(result.country).toBe("España");
      });
    });

    describe("Ubicaciones específicas (NO deben subdividirse)", () => {
      test("Given 'Lujan, Buenos Aires', should NOT subdivide (bug fix verification)", () => {
        const result = analyzeZone("Lujan, Buenos Aires");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual(["Lujan, Buenos Aires"]);
        expect(result.zoneName).toBeUndefined();
      });

      test("Given 'San Isidro, Buenos Aires', should NOT subdivide", () => {
        const result = analyzeZone("San Isidro, Buenos Aires");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual(["San Isidro, Buenos Aires"]);
      });

      test("Given 'Palermo, Buenos Aires', should NOT subdivide", () => {
        const result = analyzeZone("Palermo, Buenos Aires");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual(["Palermo, Buenos Aires"]);
      });

      test("Given 'Polanco, Ciudad de México', should NOT subdivide", () => {
        const result = analyzeZone("Polanco, Ciudad de México");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual(["Polanco, Ciudad de México"]);
      });

      test("Given 'Villa Unknown, Argentina', should NOT subdivide", () => {
        const result = analyzeZone("Villa Unknown, Argentina");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual(["Villa Unknown, Argentina"]);
      });

      test("Given empty string, should return as-is", () => {
        const result = analyzeZone("");

        expect(result.isLargeZone).toBe(false);
        expect(result.subzones).toEqual([""]);
      });

      test("Given string with extra whitespace, should trim and process", () => {
        const result = analyzeZone("  Buenos Aires  ");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("buenos_aires");
      });
    });

    describe("Zonas de otros países", () => {
      test("Given 'Bogotá', should return Colombia subzones", () => {
        const result = analyzeZone("Bogotá");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("bogota");
        expect(result.country).toBe("Colombia");
      });

      test("Given 'Santiago', should return Chile subzones", () => {
        const result = analyzeZone("Santiago");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("santiago");
        expect(result.country).toBe("Chile");
      });

      test("Given 'Lima', should return Peru subzones", () => {
        const result = analyzeZone("Lima");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("lima");
        expect(result.country).toBe("Perú");
      });

      test("Given 'Barcelona', should return Spain subzones", () => {
        const result = analyzeZone("Barcelona");

        expect(result.isLargeZone).toBe(true);
        expect(result.zoneName).toBe("barcelona");
        expect(result.country).toBe("España");
      });
    });
  });

  describe("getAvailableZones", () => {
    test("Should return all available zones with correct structure", () => {
      const zones = getAvailableZones();

      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);

      // Verificar estructura de cada zona
      for (const zone of zones) {
        expect(zone).toHaveProperty("name");
        expect(zone).toHaveProperty("aliases");
        expect(zone).toHaveProperty("subzoneCount");
        expect(Array.isArray(zone.aliases)).toBe(true);
        expect(typeof zone.subzoneCount).toBe("number");
        expect(zone.subzoneCount).toBeGreaterThan(0);
      }
    });

    test("Should include Buenos Aires zone", () => {
      const zones = getAvailableZones();
      const buenosAires = zones.find((z) => z.name === "buenos_aires");

      expect(buenosAires).toBeDefined();
      expect(buenosAires?.aliases).toContain("buenos aires");
      expect(buenosAires?.country).toBe("Argentina");
    });

    test("Should include international zones", () => {
      const zones = getAvailableZones();
      const zoneNames = zones.map((z) => z.name);

      expect(zoneNames).toContain("cdmx");
      expect(zoneNames).toContain("madrid");
      expect(zoneNames).toContain("bogota");
    });
  });

  describe("addCustomZone", () => {
    test("Should add a new custom zone", () => {
      addCustomZone(
        "Test City",
        ["test city", "tc"],
        ["Zone A, Test City", "Zone B, Test City"],
        "TestCountry"
      );

      const result = analyzeZone("test city");

      expect(result.isLargeZone).toBe(true);
      expect(result.zoneName).toBe("test_city");
      expect(result.subzones).toContain("Zone A, Test City");
      expect(result.country).toBe("TestCountry");
    });

    test("Should normalize zone name with spaces to underscores", () => {
      addCustomZone("Another Test", ["another test"], ["Sub A"], "Country");

      const zones = getAvailableZones();
      const found = zones.find((z) => z.name === "another_test");

      expect(found).toBeDefined();
    });
  });

  describe("estimateScrapeTime", () => {
    test("Given a large zone, should estimate higher time", () => {
      const estimate = estimateScrapeTime("Buenos Aires");

      expect(estimate.subzones).toBeGreaterThan(10);
      expect(estimate.estimatedMinutes).toBeGreaterThan(5);
      expect(estimate.estimatedLeads.min).toBeGreaterThan(50);
      expect(estimate.estimatedLeads.max).toBeGreaterThan(
        estimate.estimatedLeads.min
      );
    });

    test("Given a small zone, should estimate lower time", () => {
      const estimate = estimateScrapeTime("Palermo, Buenos Aires");

      expect(estimate.subzones).toBe(1);
      expect(estimate.estimatedMinutes).toBeLessThanOrEqual(1);
      expect(estimate.estimatedLeads.min).toBe(5);
      expect(estimate.estimatedLeads.max).toBe(15);
    });

    test("Estimates should be proportional to subzone count", () => {
      const smallEstimate = estimateScrapeTime("Villa Random");
      const largeEstimate = estimateScrapeTime("Buenos Aires");

      expect(largeEstimate.estimatedMinutes).toBeGreaterThan(
        smallEstimate.estimatedMinutes
      );
      expect(largeEstimate.estimatedLeads.max).toBeGreaterThan(
        smallEstimate.estimatedLeads.max
      );
    });
  });
});
