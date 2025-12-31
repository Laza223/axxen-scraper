/**
 * 🧪 Retry Service Tests (Optimized)
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
    test("succeeds on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const resultPromise = withRetry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      expect(await resultPromise).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("returns result with default options", async () => {
      const fn = vi.fn().mockResolvedValue({ data: "test" });
      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      expect(await resultPromise).toEqual({ data: "test" });
    });
  });

  describe("CircuitBreaker", () => {
    test("starts in closed state", () => {
      const cb = new CircuitBreaker(3, 10000);
      expect(cb.isOpen()).toBe(false);
    });

    test("records success and stays closed", () => {
      const cb = new CircuitBreaker(3, 10000);
      cb.recordSuccess();
      expect(cb.isOpen()).toBe(false);
    });

    test("opens after threshold failures", () => {
      const cb = new CircuitBreaker(3, 10000);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(false); // Under threshold
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true); // At threshold
    });

    test("resets to half-open after timeout", () => {
      const cb = new CircuitBreaker(2, 1000);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
      vi.advanceTimersByTime(1500);
      expect(cb.isOpen()).toBe(false); // Half-open
    });

    test("getState returns current state info", () => {
      const cb = new CircuitBreaker(3, 10000);
      const state = cb.getState();
      expect(state).toHaveProperty("state");
      expect(state).toHaveProperty("failures");
      expect(state).toHaveProperty("threshold");
    });

    test("reset clears failures", () => {
      const cb = new CircuitBreaker(2, 1000);
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.isOpen()).toBe(true);
      cb.reset();
      expect(cb.isOpen()).toBe(false);
    });

    test("execute runs function when closed", async () => {
      const cb = new CircuitBreaker(3, 10000);
      const fn = vi.fn().mockResolvedValue("result");
      const resultPromise = cb.execute(fn);
      await vi.runAllTimersAsync();
      expect(await resultPromise).toBe("result");
    });

    test("execute throws when open", async () => {
      const cb = new CircuitBreaker(2, 10000);
      cb.recordFailure();
      cb.recordFailure();
      await expect(cb.execute(vi.fn())).rejects.toThrow("Circuit breaker");
    });
  });

  describe("googleMapsCircuitBreaker", () => {
    test("is a CircuitBreaker instance with expected methods", () => {
      expect(googleMapsCircuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(typeof googleMapsCircuitBreaker.isOpen).toBe("function");
      expect(typeof googleMapsCircuitBreaker.recordSuccess).toBe("function");
      expect(typeof googleMapsCircuitBreaker.recordFailure).toBe("function");
    });
  });
});
