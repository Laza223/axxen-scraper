import Redis from "ioredis";
import logger from "./logger";

// Precios de Google Places API (por 1000 requests)
export const API_PRICES = {
  geocoding: 5.0 / 1000, // $5 per 1000
  nearbySearch: 32.0 / 1000, // $32 per 1000
  placeDetails: 17.0 / 1000, // $17 per 1000
};

export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { data: any; expires: number }> = new Map();
  private isRedisAvailable = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.info("📦 Redis no configurado, usando caché en memoria");
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn(
              "⚠️ Redis no disponible después de 3 intentos, usando caché en memoria"
            );
            return null; // Deja de reintentar
          }
          return Math.min(times * 100, 3000);
        },
        enableOfflineQueue: false,
      });

      // Registrar handlers ANTES de conectar
      this.redis.on("error", (err) => {
        if (!this.isRedisAvailable) return; // Solo loggear si estaba disponible
        logger.warn(`⚠️ Redis error: ${err.message}`);
        this.isRedisAvailable = false;
      });

      this.redis.on("reconnecting", () => {
        logger.info("🔄 Reconectando a Redis...");
      });

      this.redis.on("end", () => {
        this.isRedisAvailable = false;
      });

      await this.redis.connect();
      this.isRedisAvailable = true;
      logger.info("✅ Redis conectado correctamente");
    } catch (error) {
      logger.warn("⚠️ Redis no disponible, usando caché en memoria");
      this.isRedisAvailable = false;
      // Desconectar el cliente para evitar más intentos
      if (this.redis) {
        this.redis.disconnect();
        this.redis = null;
      }
    }
  }

  /**
   * Obtener dato del caché
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const data = await this.redis.get(key);
        if (data) {
          logger.debug(`📥 Cache HIT (Redis): ${key}`);
          return JSON.parse(data);
        }
      } else {
        // Fallback a memoria
        const cached = this.memoryCache.get(key);
        if (cached && cached.expires > Date.now()) {
          logger.debug(`📥 Cache HIT (Memory): ${key}`);
          return cached.data;
        }
        // Limpiar expirados
        if (cached) this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.warn(`Cache get error: ${error}`);
    }
    return null;
  }

  /**
   * Guardar dato en caché
   */
  async set(key: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    try {
      const serialized = JSON.stringify(data);

      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttlSeconds, serialized);
        logger.debug(`📤 Cache SET (Redis): ${key} | TTL: ${ttlSeconds}s`);
      } else {
        // Fallback a memoria
        this.memoryCache.set(key, {
          data,
          expires: Date.now() + ttlSeconds * 1000,
        });
        logger.debug(`📤 Cache SET (Memory): ${key}`);

        // Limpiar caché si es muy grande
        if (this.memoryCache.size > 10000) {
          this.cleanupMemoryCache();
        }
      }
    } catch (error) {
      logger.warn(`Cache set error: ${error}`);
    }
  }

  /**
   * Eliminar dato del caché
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key);
        logger.debug(`🗑️ Cache DELETE (Redis): ${key}`);
      } else {
        this.memoryCache.delete(key);
        logger.debug(`🗑️ Cache DELETE (Memory): ${key}`);
      }
    } catch (error) {
      logger.warn(`Cache delete error: ${error}`);
    }
  }

  /**
   * Caché específico para geocoding (ahorra $$$)
   */
  async getCachedGeocode(
    location: string
  ): Promise<{ lat: number; lng: number } | null> {
    return this.get(`geo:${location.toLowerCase().trim()}`);
  }

  async setCachedGeocode(
    location: string,
    coords: { lat: number; lng: number }
  ): Promise<void> {
    // Geocoding se cachea por 30 días (las ciudades no se mueven)
    await this.set(`geo:${location.toLowerCase().trim()}`, coords, 2592000);
  }

  /**
   * Caché para detalles de lugar
   */
  async getCachedPlaceDetails(placeId: string): Promise<any | null> {
    return this.get(`place:${placeId}`);
  }

  async setCachedPlaceDetails(placeId: string, details: any): Promise<void> {
    // Place details se cachea por 7 días
    await this.set(`place:${placeId}`, details, 604800);
  }

  /**
   * Caché para análisis de website
   */
  async getCachedWebsiteAnalysis(url: string): Promise<any | null> {
    const key = `web:${Buffer.from(url).toString("base64").slice(0, 100)}`;
    return this.get(key);
  }

  async setCachedWebsiteAnalysis(url: string, analysis: any): Promise<void> {
    const key = `web:${Buffer.from(url).toString("base64").slice(0, 100)}`;
    // Website analysis se cachea por 3 días
    await this.set(key, analysis, 259200);
  }

  /**
   * Limpiar caché de memoria
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    logger.debug(`🧹 Memory cache cleanup: ${cleaned} items removed`);
  }

  /**
   * Estadísticas del caché
   */
  async getStats(): Promise<{
    type: "redis" | "memory";
    size: number;
    connected: boolean;
  }> {
    if (this.isRedisAvailable && this.redis) {
      const dbSize = await this.redis.dbsize();
      return {
        type: "redis",
        size: dbSize,
        connected: true,
      };
    }

    return {
      type: "memory",
      size: this.memoryCache.size,
      connected: false,
    };
  }

  /**
   * Limpiar todo el caché
   */
  async clear(): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.flushdb();
        logger.info("🗑️ Redis caché limpiado");
      }
      this.memoryCache.clear();
      logger.info("🗑️ Memory caché limpiado");
    } catch (error) {
      logger.warn(`Cache clear error: ${error}`);
    }
  }

  /**
   * Cerrar conexión
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }
}

// Singleton
export const cacheService = new CacheService();
export default cacheService;
