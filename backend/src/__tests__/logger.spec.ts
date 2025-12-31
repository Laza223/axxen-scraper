/**
 * 🧪 Logger Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  format: {
    combine: vi.fn(() => ({})),
    timestamp: vi.fn(() => ({})),
    errors: vi.fn(() => ({})),
    splat: vi.fn(() => ({})),
    json: vi.fn(() => ({})),
    colorize: vi.fn(() => ({})),
    printf: vi.fn(() => ({})),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
}));

import logger from "../services/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logger is defined with standard methods", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  test("logger methods do not throw", () => {
    expect(() => logger.info("test")).not.toThrow();
    expect(() => logger.error("test")).not.toThrow();
    expect(() => logger.warn("test")).not.toThrow();
    expect(() => logger.debug("test")).not.toThrow();
  });

  test("logger handles objects in messages", () => {
    expect(() => logger.info("test", { data: "value" })).not.toThrow();
    expect(() => logger.error("test", new Error("err"))).not.toThrow();
  });
});
