/**
 * 📊 SCRAPER METRICS SERVICE
 * Métricas y estadísticas para monitorear el rendimiento del scraper
 */

import logger from "./logger";

export interface ScrapingMetrics {
  // Contadores de sesión
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  blockedRequests: number;
  captchaEncountered: number;

  // Tiempos
  averageRequestTime: number;
  totalScrapingTime: number;
  fastestRequest: number;
  slowestRequest: number;

  // Datos extraídos
  totalPlacesFound: number;
  placesWithPhone: number;
  placesWithWebsite: number;
  placesWithEmail: number;
  placesWithSocialMedia: number;

  // Calidad
  averageRelevanceScore: number;
  averageLeadScore: number;

  // Cache
  cacheHits: number;
  cacheMisses: number;

  // Timestamps
  sessionStart: Date;
  lastActivity: Date;
}

export interface RequestMetric {
  url: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp: Date;
  blocked?: boolean;
  captcha?: boolean;
}

class ScraperMetricsService {
  private metrics: ScrapingMetrics;
  private requestHistory: RequestMetric[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Inicializar métricas vacías
   */
  private initializeMetrics(): ScrapingMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      captchaEncountered: 0,

      averageRequestTime: 0,
      totalScrapingTime: 0,
      fastestRequest: Infinity,
      slowestRequest: 0,

      totalPlacesFound: 0,
      placesWithPhone: 0,
      placesWithWebsite: 0,
      placesWithEmail: 0,
      placesWithSocialMedia: 0,

      averageRelevanceScore: 0,
      averageLeadScore: 0,

      cacheHits: 0,
      cacheMisses: 0,

      sessionStart: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Registrar una request
   */
  recordRequest(metric: Omit<RequestMetric, "timestamp">): void {
    const fullMetric: RequestMetric = {
      ...metric,
      timestamp: new Date(),
    };

    this.requestHistory.push(fullMetric);

    // Mantener tamaño del historial
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
    }

    // Actualizar contadores
    this.metrics.totalRequests++;
    this.metrics.lastActivity = new Date();

    if (metric.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    if (metric.blocked) {
      this.metrics.blockedRequests++;
    }

    if (metric.captcha) {
      this.metrics.captchaEncountered++;
    }

    // Actualizar tiempos
    this.metrics.totalScrapingTime += metric.duration;
    this.metrics.averageRequestTime =
      this.metrics.totalScrapingTime / this.metrics.totalRequests;

    if (metric.duration < this.metrics.fastestRequest) {
      this.metrics.fastestRequest = metric.duration;
    }
    if (metric.duration > this.metrics.slowestRequest) {
      this.metrics.slowestRequest = metric.duration;
    }
  }

  /**
   * Registrar lugar encontrado
   */
  recordPlaceFound(place: {
    phone?: string;
    website?: string;
    email?: string;
    socialMediaUrl?: string;
    relevanceScore?: number;
    leadScore?: number;
  }): void {
    this.metrics.totalPlacesFound++;

    if (place.phone) this.metrics.placesWithPhone++;
    if (place.website) this.metrics.placesWithWebsite++;
    if (place.email) this.metrics.placesWithEmail++;
    if (place.socialMediaUrl) this.metrics.placesWithSocialMedia++;

    // Actualizar promedios
    if (place.relevanceScore !== undefined) {
      this.metrics.averageRelevanceScore =
        (this.metrics.averageRelevanceScore *
          (this.metrics.totalPlacesFound - 1) +
          place.relevanceScore) /
        this.metrics.totalPlacesFound;
    }

    if (place.leadScore !== undefined) {
      this.metrics.averageLeadScore =
        (this.metrics.averageLeadScore * (this.metrics.totalPlacesFound - 1) +
          place.leadScore) /
        this.metrics.totalPlacesFound;
    }
  }

  /**
   * Registrar hit de caché
   */
  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  /**
   * Registrar miss de caché
   */
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  /**
   * Obtener métricas actuales
   */
  getMetrics(): ScrapingMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtener historial de requests recientes
   */
  getRequestHistory(limit: number = 100): RequestMetric[] {
    return this.requestHistory.slice(-limit);
  }

  /**
   * Calcular tasa de éxito
   */
  getSuccessRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Calcular tasa de bloqueos
   */
  getBlockRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.blockedRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Calcular tasa de cache hit
   */
  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return (this.metrics.cacheHits / total) * 100;
  }

  /**
   * Obtener estadísticas de calidad de datos
   */
  getDataQualityStats(): {
    phoneRate: number;
    websiteRate: number;
    emailRate: number;
    socialMediaRate: number;
  } {
    const total = this.metrics.totalPlacesFound || 1;
    return {
      phoneRate: (this.metrics.placesWithPhone / total) * 100,
      websiteRate: (this.metrics.placesWithWebsite / total) * 100,
      emailRate: (this.metrics.placesWithEmail / total) * 100,
      socialMediaRate: (this.metrics.placesWithSocialMedia / total) * 100,
    };
  }

  /**
   * Obtener resumen para logging
   */
  getSummary(): string {
    const successRate = this.getSuccessRate().toFixed(1);
    const blockRate = this.getBlockRate().toFixed(1);
    const cacheRate = this.getCacheHitRate().toFixed(1);
    const avgTime = this.metrics.averageRequestTime.toFixed(0);

    return `📊 Métricas: ${this.metrics.totalRequests} requests | ${successRate}% éxito | ${blockRate}% bloqueados | ${cacheRate}% cache | ${avgTime}ms promedio`;
  }

  /**
   * Log resumen detallado
   */
  logDetailedSummary(): void {
    const quality = this.getDataQualityStats();
    const duration =
      (new Date().getTime() - this.metrics.sessionStart.getTime()) / 1000;

    logger.info("\n═══════════════════════════════════════");
    logger.info("📊 RESUMEN DE SESIÓN DE SCRAPING");
    logger.info("═══════════════════════════════════════");
    logger.info(`⏱️  Duración: ${duration.toFixed(0)} segundos`);
    logger.info(`📍 Lugares encontrados: ${this.metrics.totalPlacesFound}`);
    logger.info(`✅ Tasa de éxito: ${this.getSuccessRate().toFixed(1)}%`);
    logger.info(`🚫 Bloqueos: ${this.metrics.blockedRequests}`);
    logger.info(`🔐 CAPTCHAs: ${this.metrics.captchaEncountered}`);
    logger.info("───────────────────────────────────────");
    logger.info(`📞 Con teléfono: ${quality.phoneRate.toFixed(1)}%`);
    logger.info(`🌐 Con website: ${quality.websiteRate.toFixed(1)}%`);
    logger.info(`📧 Con email: ${quality.emailRate.toFixed(1)}%`);
    logger.info(`📱 Con RRSS: ${quality.socialMediaRate.toFixed(1)}%`);
    logger.info("───────────────────────────────────────");
    logger.info(
      `⭐ Score relevancia promedio: ${this.metrics.averageRelevanceScore.toFixed(
        1
      )}`
    );
    logger.info(
      `🎯 Lead score promedio: ${this.metrics.averageLeadScore.toFixed(1)}`
    );
    logger.info("═══════════════════════════════════════\n");
  }

  /**
   * Resetear métricas
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.requestHistory = [];
    logger.info("📊 Métricas reseteadas");
  }

  /**
   * Exportar métricas a JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        successRate: this.getSuccessRate(),
        blockRate: this.getBlockRate(),
        cacheHitRate: this.getCacheHitRate(),
        dataQuality: this.getDataQualityStats(),
        recentRequests: this.getRequestHistory(50),
      },
      null,
      2
    );
  }
}

export const scraperMetrics = new ScraperMetricsService();
export default scraperMetrics;
