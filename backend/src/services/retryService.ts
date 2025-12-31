/**
 * 🔄 RETRY SERVICE
 * Sistema de reintentos con exponential backoff
 * Esencial para scrapers robustos
 */

import logger from "./logger";

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  retryOn?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

// Errores que siempre deberían reintentar
const RETRYABLE_ERRORS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "ENOTFOUND",
  "ENETUNREACH",
  "EAI_AGAIN",
  "Navigation timeout",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_INTERNET_DISCONNECTED",
  "net::ERR_PROXY_CONNECTION_FAILED",
  "Protocol error",
  "Target closed",
  "Session closed",
  "Execution context was destroyed",
];

// Errores que NUNCA deberían reintentar
const NON_RETRYABLE_ERRORS = [
  "net::ERR_CERT_",
  "net::ERR_SSL_",
  "Invalid URL",
  "ERR_INVALID_URL",
];

/**
 * Determinar si un error es reintentable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message || "";

  // Verificar si es un error no reintentable
  for (const pattern of NON_RETRYABLE_ERRORS) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  // Verificar si es un error reintentable
  for (const pattern of RETRYABLE_ERRORS) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  // Por defecto, reintentar errores de red
  return message.includes("net::") || message.includes("timeout");
}

/**
 * Calcular delay con jitter para evitar thundering herd
 */
function calculateDelayWithJitter(
  attempt: number,
  options: RetryOptions
): number {
  const exponentialDelay =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const boundedDelay = Math.min(exponentialDelay, options.maxDelay);

  // Agregar jitter (±25%)
  const jitter = boundedDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.round(boundedDelay + jitter);
}

/**
 * Ejecutar función con reintentos
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = "operation"
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Verificar si debemos reintentar
      const shouldRetry = opts.retryOn
        ? opts.retryOn(error)
        : isRetryableError(error);

      if (!shouldRetry || attempt >= opts.maxRetries) {
        logger.error(
          `❌ ${operationName} falló después de ${attempt + 1} intentos: ${
            error.message
          }`
        );
        throw error;
      }

      const delay = calculateDelayWithJitter(attempt, opts);
      logger.warn(
        `⚠️ ${operationName} falló (intento ${attempt + 1}/${
          opts.maxRetries + 1
        }), reintentando en ${delay}ms: ${error.message}`
      );

      await sleep(delay);
    }
  }

  throw lastError || new Error(`${operationName} falló sin error específico`);
}

/**
 * Decorator para reintentar métodos de clase
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options,
        `${target.constructor.name}.${propertyKey}`
      );
    };

    return descriptor;
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker para prevenir cascadas de fallos
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 60000 // 1 minuto
  ) {}

  /**
   * Verificar si el circuit está abierto
   */
  isOpen(): boolean {
    if (this.state === "open") {
      // Verificar si podemos pasar a half-open
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = "half-open";
        logger.info("🔄 Circuit breaker: half-open");
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Registrar éxito
   */
  recordSuccess(): void {
    this.failures = 0;
    if (this.state === "half-open") {
      this.state = "closed";
      logger.info("✅ Circuit breaker: cerrado (recuperado)");
    }
  }

  /**
   * Registrar fallo
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "open";
      logger.warn(
        `⚡ Circuit breaker: abierto (${this.failures} fallos consecutivos)`
      );
    }
  }

  /**
   * Ejecutar función con circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error("Circuit breaker está abierto");
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Obtener estado actual
   */
  getState(): { state: string; failures: number; threshold: number } {
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
    };
  }

  /**
   * Resetear el circuit breaker
   */
  reset(): void {
    this.failures = 0;
    this.state = "closed";
    logger.info("🔄 Circuit breaker: reseteado manualmente");
  }
}

// Circuit breaker global para Google Maps
export const googleMapsCircuitBreaker = new CircuitBreaker(5, 60000);

export default {
  withRetry,
  Retry,
  CircuitBreaker,
  googleMapsCircuitBreaker,
  isRetryableError,
};
