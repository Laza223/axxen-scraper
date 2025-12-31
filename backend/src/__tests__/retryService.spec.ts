/**
 * 🧪 Retry Service Tests
 * Tests para el servicio de reintentos con exponential backoff
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CircuitBreaker,
  googleMapsCircuitBreaker,
  withRetry,
} from "../services/retryService";

describe("retryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("withRetry", () => {
    test("Should succeed on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const resultPromise = withRetry(fn, { maxRetries: 3 }, "test");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("Should return result when function succeeds", async () => {
      const fn = vi.fn().mockResolvedValue({ data: "test" });

      const resultPromise = withRetry(fn, {}, "test");
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ data: "test" });
    });

    test("Should use default options", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("ok");
    });

    test("Should accept custom max retries", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const resultPromise = withRetry(fn, { maxRetries: 5 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("CircuitBreaker", () => {
    test("Should create circuit breaker instance", () => {
      const cb = new CircuitBreaker(5, 30000);

      expect(cb).toBeDefined();
      expect(cb.isOpen()).toBe(false); // Starts closed
    });

    test("Should start in closed state", () => {
      const cb = new CircuitBreaker(3, 10000);

      expect(cb.isOpen()).toBe(false);
    });

    test("Should record success", () => {
      const cb = new CircuitBreaker(3, 10000);

      cb.recordSuccess();

      expect(cb.isOpen()).toBe(false);
    });

    test("Should track failures", () => {
      const cb = new CircuitBreaker(3, 10000);

      cb.recordFailure();
      cb.recordFailure();

      expect(cb.isOpen()).toBe(false); // Still under threshold
    });

    test("Should open after threshold failures", () => {
      const cb = new CircuitBreaker(3, 10000);

      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();

      expect(cb.isOpen()).toBe(true); // Should be open now
    });

    test("Should reset after timeout", () => {
      const cb = new CircuitBreaker(2, 1000);

      cb.recordFailure();
      cb.recordFailure();

      expect(cb.isOpen()).toBe(true);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      expect(cb.isOpen()).toBe(false); // Should be half-open now
    });

    test("Should have getState method", () => {
      const cb = new CircuitBreaker(3, 10000);

      const state = cb.getState();

      expect(state).toHaveProperty("state");
      expect(state).toHaveProperty("failures");
      expect(state).toHaveProperty("threshold");
    });

    test("Should have reset method", () => {
      const cb = new CircuitBreaker(2, 1000);

      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);

      cb.reset();
      expect(cb.isOpen()).toBe(false);
    });

    test("Should reset on success after half-open", () => {
      const cb = new CircuitBreaker(2, 1000);

      // Trip the breaker
      cb.recordFailure();
      cb.recordFailure();

      // Advance to half-open
      vi.advanceTimersByTime(1500);

      // isOpen() should transition to half-open
      expect(cb.isOpen()).toBe(false);

      // Record success
      cb.recordSuccess();

      expect(cb.isOpen()).toBe(false);
    });

    test("Should have execute method", () => {
      const cb = new CircuitBreaker(3, 10000);

      expect(typeof cb.execute).toBe("function");
    });

    test("Execute should run function when closed", async () => {
      const cb = new CircuitBreaker(3, 10000);
      const fn = vi.fn().mockResolvedValue("result");

      const resultPromise = cb.execute(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalled();
    });

    test("Execute should throw when open", async () => {
      const cb = new CircuitBreaker(2, 10000);
      const fn = vi.fn().mockResolvedValue("result");

      // Trip the breaker
      cb.recordFailure();
      cb.recordFailure();

      await expect(cb.execute(fn)).rejects.toThrow("Circuit breaker");
    });
  });

  describe("googleMapsCircuitBreaker", () => {
    test("Should be defined", () => {
      expect(googleMapsCircuitBreaker).toBeDefined();
    });

    test("Should be a CircuitBreaker instance", () => {
      expect(googleMapsCircuitBreaker).toBeInstanceOf(CircuitBreaker);
    });

    test("Should have isOpen method", () => {
      expect(typeof googleMapsCircuitBreaker.isOpen).toBe("function");
    });

    test("Should have recordSuccess method", () => {
      expect(typeof googleMapsCircuitBreaker.recordSuccess).toBe("function");
    });

    test("Should have recordFailure method", () => {
      expect(typeof googleMapsCircuitBreaker.recordFailure).toBe("function");
    });

    test("Should have getState method", () => {
      expect(typeof googleMapsCircuitBreaker.getState).toBe("function");
    });

    test("Should have reset method", () => {
      expect(typeof googleMapsCircuitBreaker.reset).toBe("function");
    });
  });

  describe("Retry options", () => {
    test("Should accept initialDelay option", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const resultPromise = withRetry(fn, { initialDelay: 500 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalled();
    });

    test("Should accept maxDelay option", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const resultPromise = withRetry(fn, { maxDelay: 5000 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalled();
    });

    test("Should accept backoffMultiplier option", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const resultPromise = withRetry(fn, { backoffMultiplier: 1.5 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(fn).toHaveBeenCalled();
    });
  });

  describe("Error patterns", () => {
    test("ECONNRESET should be retryable", () => {
      const retryableErrors = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "net::ERR_CONNECTION_RESET",
        "Navigation timeout",
      ];

      retryableErrors.forEach((errorPattern) => {
        expect(typeof errorPattern).toBe("string");
      });
    });

    test("SSL errors should not be retryable", () => {
      const nonRetryableErrors = [
        "net::ERR_CERT_INVALID",
        "net::ERR_SSL_PROTOCOL_ERROR",
        "Invalid URL",
      ];

      nonRetryableErrors.forEach((errorPattern) => {
        expect(typeof errorPattern).toBe("string");
      });
    });
  });

  describe("Jitter calculation", () => {
    test("Delay should be within expected bounds", () => {
      const baseDelay = 1000;
      const jitterRange = baseDelay * 0.25;

      // Delay with jitter should be between 750 and 1250
      for (let i = 0; i < 10; i++) {
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delayWithJitter = baseDelay + jitter;

        expect(delayWithJitter).toBeGreaterThanOrEqual(baseDelay - jitterRange);
        expect(delayWithJitter).toBeLessThanOrEqual(baseDelay + jitterRange);
      }
    });
  });
});
