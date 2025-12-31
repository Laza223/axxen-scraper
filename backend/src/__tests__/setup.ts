/**
 * 🧪 Test Setup
 * Configuración global para todos los tests
 */

import { afterEach, vi } from "vitest";

// Mock del logger para evitar logs en tests
vi.mock("../services/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
  scrapingLogger: {
    start: vi.fn(),
    found: vi.fn(),
    processing: vi.fn(),
    lead: vi.fn(),
    skip: vi.fn(),
    error: vi.fn(),
    complete: vi.fn(),
    api: vi.fn(),
  },
}));

// Configuración global de timeouts
vi.setConfig({
  testTimeout: 30000,
});

// Limpiar mocks después de cada test
afterEach(() => {
  vi.clearAllMocks();
});
