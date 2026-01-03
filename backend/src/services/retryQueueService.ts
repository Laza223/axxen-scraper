/**
 * 🔁 RETRY QUEUE SERVICE
 *
 * Servicio para manejar reintentos inteligentes de scraping fallido.
 * Guarda en cola los items que fallaron para reintentar después.
 */

import logger from "./logger";

// ============================================================================
// INTERFACES
// ============================================================================

export interface RetryItem {
  id: string;
  type: "place_details" | "email_discovery" | "enrichment" | "grid_cell";
  data: any; // Datos necesarios para reintentar
  url?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttempt: Date | null;
  nextRetryAt: Date;
  priority: "high" | "normal" | "low";
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface RetryQueueStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface RetryResult {
  success: boolean;
  item: RetryItem;
  result?: any;
  error?: string;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 5000, // 5 segundos base
  MAX_DELAY_MS: 60000, // 1 minuto máximo
  EXPONENTIAL_FACTOR: 2, // Delay exponencial
  CLEANUP_AFTER_HOURS: 24, // Limpiar items completados/fallidos después de 24 horas
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class RetryQueueService {
  private queue: Map<string, RetryItem> = new Map();
  private processing: Set<string> = new Set();

  /**
   * Agrega un item a la cola de reintentos
   */
  enqueue(
    type: RetryItem["type"],
    data: any,
    options: {
      url?: string;
      error?: string;
      maxAttempts?: number;
      priority?: RetryItem["priority"];
    } = {}
  ): RetryItem {
    const id = this.generateId(type, data);

    // Si ya existe, solo actualizar intentos
    if (this.queue.has(id)) {
      const existing = this.queue.get(id)!;
      existing.attempts++;
      existing.lastAttempt = new Date();
      existing.error = options.error || existing.error;
      existing.nextRetryAt = this.calculateNextRetry(existing.attempts);

      if (existing.attempts >= existing.maxAttempts) {
        existing.status = "failed";
        logger.warn(
          `❌ Item fallido definitivamente: ${id} (${existing.attempts} intentos)`
        );
      }

      return existing;
    }

    // Crear nuevo item
    const item: RetryItem = {
      id,
      type,
      data,
      url: options.url,
      error: options.error,
      attempts: 1,
      maxAttempts: options.maxAttempts || CONFIG.MAX_ATTEMPTS,
      createdAt: new Date(),
      lastAttempt: null,
      nextRetryAt: this.calculateNextRetry(1),
      priority: options.priority || "normal",
      status: "pending",
    };

    this.queue.set(id, item);
    logger.info(`📋 Item agregado a cola de reintentos: ${type} (${id})`);

    return item;
  }

  /**
   * Obtiene items listos para reintentar
   */
  getReadyItems(limit: number = 10): RetryItem[] {
    const now = new Date();
    const ready: RetryItem[] = [];

    for (const item of this.queue.values()) {
      if (
        item.status === "pending" &&
        item.nextRetryAt <= now &&
        !this.processing.has(item.id)
      ) {
        ready.push(item);
        if (ready.length >= limit) break;
      }
    }

    // Ordenar por prioridad y antigüedad
    return ready.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Marca un item como en proceso
   */
  markInProgress(id: string): void {
    const item = this.queue.get(id);
    if (item) {
      item.status = "in_progress";
      item.lastAttempt = new Date();
      this.processing.add(id);
    }
  }

  /**
   * Marca un item como completado exitosamente
   */
  markCompleted(id: string, result?: any): void {
    const item = this.queue.get(id);
    if (item) {
      item.status = "completed";
      this.processing.delete(id);
      logger.info(`✅ Retry exitoso: ${item.type} (${id})`);
    }
  }

  /**
   * Marca un item como fallido en este intento
   */
  markFailed(id: string, error: string): void {
    const item = this.queue.get(id);
    if (item) {
      item.error = error;
      item.attempts++;
      this.processing.delete(id);

      if (item.attempts >= item.maxAttempts) {
        item.status = "failed";
        logger.error(
          `❌ Retry fallido definitivamente: ${item.type} (${id}) - ${error}`
        );
      } else {
        item.status = "pending";
        item.nextRetryAt = this.calculateNextRetry(item.attempts);
        logger.warn(
          `⚠️ Retry fallido (intento ${item.attempts}/${item.maxAttempts}): ${item.type} - ${error}`
        );
      }
    }
  }

  /**
   * Ejecuta el proceso de reintentos con un handler
   */
  async processQueue(
    handler: (item: RetryItem) => Promise<any>,
    options: {
      limit?: number;
      concurrency?: number;
      delayBetween?: number;
    } = {}
  ): Promise<RetryResult[]> {
    const limit = options.limit || 10;
    const concurrency = options.concurrency || 1;
    const delayBetween = options.delayBetween || 2000;

    const readyItems = this.getReadyItems(limit);
    if (readyItems.length === 0) {
      return [];
    }

    logger.info(`🔄 Procesando ${readyItems.length} items de retry...`);

    const results: RetryResult[] = [];

    // Procesar en batches según concurrencia
    for (let i = 0; i < readyItems.length; i += concurrency) {
      const batch = readyItems.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          this.markInProgress(item.id);

          try {
            const result = await handler(item);
            this.markCompleted(item.id, result);
            return { success: true, item, result };
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            this.markFailed(item.id, errorMsg);
            return { success: false, item, error: errorMsg };
          }
        })
      );

      results.push(...batchResults);

      // Delay entre batches
      if (i + concurrency < readyItems.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetween));
      }
    }

    const successful = results.filter((r) => r.success).length;
    logger.info(
      `✅ Retry completado: ${successful}/${results.length} exitosos`
    );

    return results;
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats(): RetryQueueStats {
    const stats: RetryQueueStats = {
      total: this.queue.size,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      byType: {},
      byPriority: { high: 0, normal: 0, low: 0 },
    };

    for (const item of this.queue.values()) {
      switch (item.status) {
        case "pending":
          stats.pending++;
          break;
        case "in_progress":
          stats.inProgress++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "failed":
          stats.failed++;
          break;
      }
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      stats.byPriority[item.priority]++;
    }

    return stats;
  }

  /**
   * Obtiene items por tipo
   */
  getByType(type: RetryItem["type"]): RetryItem[] {
    return Array.from(this.queue.values()).filter((item) => item.type === type);
  }

  /**
   * Obtiene items fallidos definitivamente
   */
  getFailedItems(): RetryItem[] {
    return Array.from(this.queue.values()).filter(
      (item) => item.status === "failed"
    );
  }

  /**
   * Limpia items antiguos (completados/fallidos)
   */
  cleanup(): number {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - CONFIG.CLEANUP_AFTER_HOURS);

    let removed = 0;
    for (const [id, item] of this.queue.entries()) {
      if (
        (item.status === "completed" || item.status === "failed") &&
        item.lastAttempt &&
        item.lastAttempt < cutoff
      ) {
        this.queue.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`🧹 Limpieza de cola: ${removed} items removidos`);
    }

    return removed;
  }

  /**
   * Resetea un item fallido para reintentar
   */
  resetItem(id: string): boolean {
    const item = this.queue.get(id);
    if (item && item.status === "failed") {
      item.attempts = 0;
      item.status = "pending";
      item.nextRetryAt = new Date();
      logger.info(`🔄 Item reseteado: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Vacía la cola completamente
   */
  clear(): void {
    this.queue.clear();
    this.processing.clear();
    logger.info("🗑️ Cola de reintentos vaciada");
  }

  /**
   * Exporta la cola para persistencia
   */
  export(): RetryItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Importa items a la cola
   */
  import(items: RetryItem[]): void {
    for (const item of items) {
      // Resetear items in_progress a pending
      if (item.status === "in_progress") {
        item.status = "pending";
      }
      // Convertir fechas de string a Date
      item.createdAt = new Date(item.createdAt);
      item.nextRetryAt = new Date(item.nextRetryAt);
      if (item.lastAttempt) {
        item.lastAttempt = new Date(item.lastAttempt);
      }
      this.queue.set(item.id, item);
    }
    logger.info(`📥 Importados ${items.length} items a cola de reintentos`);
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  /**
   * Genera un ID único para un item
   */
  private generateId(type: string, data: any): string {
    const identifier =
      data.url || data.placeId || data.name || JSON.stringify(data);
    const hash = this.simpleHash(identifier);
    return `${type}_${hash}`;
  }

  /**
   * Hash simple para generar IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calcula próximo retry con backoff exponencial
   */
  private calculateNextRetry(attempts: number): Date {
    const delay = Math.min(
      CONFIG.BASE_DELAY_MS * Math.pow(CONFIG.EXPONENTIAL_FACTOR, attempts - 1),
      CONFIG.MAX_DELAY_MS
    );

    const next = new Date();
    next.setTime(next.getTime() + delay);
    return next;
  }
}

export default new RetryQueueService();
