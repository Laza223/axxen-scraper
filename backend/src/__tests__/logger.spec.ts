/**
 * 🧪 Logger Service Tests
 * Tests para el servicio de logging con Winston
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import logger, { scrapingLogger } from "../services/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Logger instance", () => {
    test("Should be defined", () => {
      expect(logger).toBeDefined();
    });

    test("Should have info method", () => {
      expect(typeof logger.info).toBe("function");
    });

    test("Should have error method", () => {
      expect(typeof logger.error).toBe("function");
    });

    test("Should have warn method", () => {
      expect(typeof logger.warn).toBe("function");
    });

    test("Should have debug method", () => {
      expect(typeof logger.debug).toBe("function");
    });
  });

  describe("info logging", () => {
    test("Should log info message without throwing", () => {
      expect(() => logger.info("Test info message")).not.toThrow();
    });

    test("Should log info with metadata", () => {
      expect(() =>
        logger.info("Info with data", { userId: 123 })
      ).not.toThrow();
    });
  });

  describe("error logging", () => {
    test("Should log error message without throwing", () => {
      expect(() => logger.error("Test error message")).not.toThrow();
    });

    test("Should log error with Error object", () => {
      const error = new Error("Test error");
      expect(() => logger.error("Error occurred", { error })).not.toThrow();
    });

    test("Should log error with stack trace", () => {
      const error = new Error("Stack trace test");
      expect(() =>
        logger.error("Error with stack", { error, stack: error.stack })
      ).not.toThrow();
    });
  });

  describe("warn logging", () => {
    test("Should log warning message without throwing", () => {
      expect(() => logger.warn("Test warning")).not.toThrow();
    });

    test("Should log warning with context", () => {
      expect(() =>
        logger.warn("Rate limit approaching", { current: 90, max: 100 })
      ).not.toThrow();
    });
  });

  describe("debug logging", () => {
    test("Should log debug message without throwing", () => {
      expect(() => logger.debug("Debug info")).not.toThrow();
    });

    test("Should log debug with detailed data", () => {
      expect(() =>
        logger.debug("Scrape details", {
          url: "https://test.com",
          duration: 150,
          results: 10,
        })
      ).not.toThrow();
    });
  });

  describe("Log levels", () => {
    test("Should have standard log levels", () => {
      const levels = ["info", "error", "warn", "debug"];

      levels.forEach((level) => {
        expect(typeof (logger as any)[level]).toBe("function");
      });
    });
  });

  describe("Structured logging", () => {
    test("Should support structured log data", () => {
      const logData = {
        action: "scrape",
        target: "Google Maps",
        results: 50,
        duration: 1500,
      };

      expect(() => logger.info("Scrape completed", logData)).not.toThrow();
    });

    test("Should handle nested objects", () => {
      const logData = {
        request: {
          method: "GET",
          url: "https://api.test.com",
        },
        response: {
          status: 200,
          data: { count: 10 },
        },
      };

      expect(() => logger.info("API request", logData)).not.toThrow();
    });

    test("Should handle arrays in log data", () => {
      expect(() =>
        logger.info("Multiple zones", { zones: ["Zone1", "Zone2", "Zone3"] })
      ).not.toThrow();
    });
  });

  describe("Error handling", () => {
    test("Should not throw on null message", () => {
      expect(() => logger.info(null as any)).not.toThrow();
    });

    test("Should not throw on undefined message", () => {
      expect(() => logger.info(undefined as any)).not.toThrow();
    });

    test("Should handle circular references", () => {
      const obj: any = { name: "test" };
      obj.self = obj;

      // Winston debería manejar esto internamente
      expect(() => logger.info("Circular", obj)).not.toThrow();
    });
  });

  describe("Performance", () => {
    test("Should log quickly for many messages", () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        logger.debug(`Message ${i}`);
      }

      const duration = Date.now() - startTime;

      // Debería ser rápido (menos de 1 segundo para 100 mensajes)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Child logger", () => {
    test("Should create child logger with context", () => {
      const childLogger = logger.child({ module: "scraper" });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
    });
  });

  describe("scrapingLogger helper", () => {
    test("Should have start method", () => {
      expect(typeof scrapingLogger.start).toBe("function");
    });

    test("Should have found method", () => {
      expect(typeof scrapingLogger.found).toBe("function");
    });

    test("Should have processing method", () => {
      expect(typeof scrapingLogger.processing).toBe("function");
    });

    test("Should have lead method", () => {
      expect(typeof scrapingLogger.lead).toBe("function");
    });

    test("Should have skip method", () => {
      expect(typeof scrapingLogger.skip).toBe("function");
    });

    test("Should have error method", () => {
      expect(typeof scrapingLogger.error).toBe("function");
    });

    test("Should have complete method", () => {
      expect(typeof scrapingLogger.complete).toBe("function");
    });

    test("Should have api method", () => {
      expect(typeof scrapingLogger.api).toBe("function");
    });

    test("start should not throw", () => {
      expect(() =>
        scrapingLogger.start("restaurante", "Buenos Aires")
      ).not.toThrow();
    });

    test("found should not throw", () => {
      expect(() => scrapingLogger.found(50)).not.toThrow();
    });

    test("processing should not throw", () => {
      expect(() =>
        scrapingLogger.processing("Restaurant ABC", 1, 10)
      ).not.toThrow();
    });

    test("lead should not throw", () => {
      expect(() => scrapingLogger.lead("Lead Name", 85)).not.toThrow();
    });

    test("skip should not throw", () => {
      expect(() =>
        scrapingLogger.skip("Skipped Place", "no website")
      ).not.toThrow();
    });

    test("error should not throw", () => {
      expect(() =>
        scrapingLogger.error("test context", new Error("test error"))
      ).not.toThrow();
    });

    test("complete should not throw", () => {
      expect(() => scrapingLogger.complete(25, 5000)).not.toThrow();
    });

    test("api should not throw", () => {
      expect(() => scrapingLogger.api("geocoding", 0.005)).not.toThrow();
    });
  });
});
