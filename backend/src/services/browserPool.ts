import puppeteer, { Browser, Page } from "puppeteer";
import antiDetection from "./antiDetection";
import logger from "./logger";

/**
 * 🎱 Browser Pool - Reutiliza navegadores para máxima eficiencia
 *
 * En lugar de crear y cerrar navegadores constantemente (lento y detectable),
 * mantenemos un pool de navegadores listos para usar.
 *
 * Beneficios:
 * - 🚀 Performance: Evita el overhead de iniciar navegadores
 * - 🔒 Anti-detección: Menos inicializaciones = menos patrones detectables
 * - 💾 Memoria: Controla cuántos navegadores están activos
 * - ⚡ Latencia: Las páginas se abren instantáneamente
 */

interface BrowserInstance {
  browser: Browser;
  id: string;
  userAgent: string;
  resolution: { width: number; height: number };
  createdAt: Date;
  lastUsed: Date;
  pagesOpened: number;
  inUse: boolean;
}

interface PoolConfig {
  minBrowsers: number; // Navegadores mínimos en el pool
  maxBrowsers: number; // Navegadores máximos permitidos
  maxPagesPerBrowser: number; // Páginas máximas antes de reciclar
  browserTTL: number; // Tiempo de vida en ms (30 min default)
  idleTimeout: number; // Cerrar navegadores idle después de X ms
}

const DEFAULT_CONFIG: PoolConfig = {
  minBrowsers: 1,
  maxBrowsers: 3,
  maxPagesPerBrowser: 50,
  browserTTL: 30 * 60 * 1000, // 30 minutos
  idleTimeout: 5 * 60 * 1000, // 5 minutos
};

class BrowserPool {
  private pool: Map<string, BrowserInstance> = new Map();
  private config: PoolConfig;
  private isInitialized = false;
  private maintenanceInterval?: NodeJS.Timeout;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicializar el pool con los navegadores mínimos
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info(
      `🎱 Inicializando Browser Pool (min: ${this.config.minBrowsers}, max: ${this.config.maxBrowsers})`
    );

    // Crear navegadores mínimos
    const initPromises = Array(this.config.minBrowsers)
      .fill(null)
      .map(() => this.createBrowser());

    await Promise.all(initPromises);

    // Iniciar mantenimiento periódico
    this.startMaintenance();

    this.isInitialized = true;
    logger.info(`✅ Browser Pool listo con ${this.pool.size} navegadores`);
  }

  /**
   * Crear una nueva instancia de navegador
   */
  private async createBrowser(): Promise<BrowserInstance> {
    const id = `browser_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;
    const userAgent = antiDetection.getRandomUserAgent();
    const resolution = antiDetection.getRandomResolution();

    logger.debug(`🚀 Creando navegador ${id}...`);

    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      `--window-size=${resolution.width},${resolution.height}`,
      "--lang=es-AR",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-extensions",
      "--disable-plugins-discovery",
      "--disable-background-networking",
    ];

    const browser = await puppeteer.launch({
      headless: "new",
      args: launchArgs,
      defaultViewport: resolution,
    });

    const instance: BrowserInstance = {
      browser,
      id,
      userAgent,
      resolution,
      createdAt: new Date(),
      lastUsed: new Date(),
      pagesOpened: 0,
      inUse: false,
    };

    this.pool.set(id, instance);
    logger.debug(
      `✅ Navegador ${id} creado | UA: ${userAgent.substring(0, 40)}...`
    );

    return instance;
  }

  /**
   * Obtener un navegador disponible del pool
   */
  async acquire(): Promise<{
    browser: Browser;
    page: Page;
    instanceId: string;
    userAgent: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Buscar navegador disponible
    let instance = this.findAvailableBrowser();

    // Si no hay disponible y podemos crear más, hacerlo
    if (!instance && this.pool.size < this.config.maxBrowsers) {
      instance = await this.createBrowser();
    }

    // Si aún no hay (pool lleno), esperar a que uno se libere
    if (!instance) {
      logger.debug("⏳ Pool lleno, esperando navegador disponible...");
      instance = await this.waitForAvailable();
    }

    // Marcar como en uso
    instance.inUse = true;
    instance.lastUsed = new Date();
    instance.pagesOpened++;

    // Crear nueva página con configuración anti-detección
    const page = await instance.browser.newPage();
    await this.configurePage(page, instance);

    logger.debug(
      `📖 Página abierta en ${instance.id} (total: ${instance.pagesOpened})`
    );

    return {
      browser: instance.browser,
      page,
      instanceId: instance.id,
      userAgent: instance.userAgent,
    };
  }

  /**
   * Liberar un navegador después de usarlo
   */
  async release(instanceId: string, page?: Page): Promise<void> {
    const instance = this.pool.get(instanceId);
    if (!instance) return;

    // Cerrar la página si se proporcionó
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignorar errores al cerrar
      }
    }

    instance.inUse = false;
    instance.lastUsed = new Date();

    // Reciclar si excede el límite de páginas
    if (instance.pagesOpened >= this.config.maxPagesPerBrowser) {
      logger.debug(
        `♻️ Reciclando ${instance.id} (${instance.pagesOpened} páginas)`
      );
      await this.recycleBrowser(instanceId);
    }
  }

  /**
   * Configurar página con anti-detección
   */
  private async configurePage(
    page: Page,
    instance: BrowserInstance
  ): Promise<void> {
    await page.setUserAgent(instance.userAgent);
    await page.setExtraHTTPHeaders(antiDetection.getRandomHeaders());

    // Ocultar webdriver
    await page.evaluateOnNewDocument(function () {
      Object.defineProperty(navigator, "webdriver", {
        get: function () {
          return false;
        },
      });
      Object.defineProperty(navigator, "plugins", {
        get: function () {
          return [1, 2, 3, 4, 5];
        },
      });
      Object.defineProperty(navigator, "languages", {
        get: function () {
          return ["es-AR", "es", "en"];
        },
      });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });
  }

  /**
   * Buscar navegador disponible
   */
  private findAvailableBrowser(): BrowserInstance | null {
    for (const instance of this.pool.values()) {
      if (
        !instance.inUse &&
        instance.pagesOpened < this.config.maxPagesPerBrowser
      ) {
        return instance;
      }
    }
    return null;
  }

  /**
   * Esperar a que un navegador esté disponible
   */
  private async waitForAvailable(timeout = 30000): Promise<BrowserInstance> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const instance = this.findAvailableBrowser();
      if (instance) return instance;
      await new Promise((r) => setTimeout(r, 100));
    }

    throw new Error("Timeout esperando navegador disponible");
  }

  /**
   * Reciclar un navegador (cerrar y crear uno nuevo)
   */
  private async recycleBrowser(id: string): Promise<void> {
    const instance = this.pool.get(id);
    if (!instance) return;

    try {
      await instance.browser.close();
    } catch {
      // Ignorar errores al cerrar
    }

    this.pool.delete(id);

    // Crear uno nuevo si estamos bajo el mínimo
    if (this.pool.size < this.config.minBrowsers) {
      await this.createBrowser();
    }
  }

  /**
   * Mantenimiento periódico del pool
   */
  private startMaintenance(): void {
    this.maintenanceInterval = setInterval(async () => {
      const now = Date.now();

      for (const [id, instance] of this.pool.entries()) {
        if (instance.inUse) continue;

        const age = now - instance.createdAt.getTime();
        const idle = now - instance.lastUsed.getTime();

        // Cerrar navegadores muy viejos
        if (age > this.config.browserTTL) {
          logger.debug(
            `⏰ Cerrando ${id} por TTL (${Math.round(age / 60000)} min)`
          );
          await this.recycleBrowser(id);
          continue;
        }

        // Cerrar navegadores idle si tenemos más del mínimo
        if (
          idle > this.config.idleTimeout &&
          this.pool.size > this.config.minBrowsers
        ) {
          logger.debug(`💤 Cerrando ${id} por inactividad`);
          await this.recycleBrowser(id);
        }
      }
    }, 60000); // Cada minuto
  }

  /**
   * Obtener estadísticas del pool
   */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    totalPagesOpened: number;
  } {
    let available = 0;
    let inUse = 0;
    let totalPagesOpened = 0;

    for (const instance of this.pool.values()) {
      if (instance.inUse) {
        inUse++;
      } else {
        available++;
      }
      totalPagesOpened += instance.pagesOpened;
    }

    return {
      total: this.pool.size,
      available,
      inUse,
      totalPagesOpened,
    };
  }

  /**
   * Cerrar todo el pool
   */
  async shutdown(): Promise<void> {
    logger.info("🔒 Cerrando Browser Pool...");

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }

    const closePromises = Array.from(this.pool.values()).map(
      async (instance) => {
        try {
          await instance.browser.close();
        } catch {
          // Ignorar errores al cerrar
        }
      }
    );

    await Promise.all(closePromises);
    this.pool.clear();
    this.isInitialized = false;

    logger.info("✅ Browser Pool cerrado");
  }
}

// Singleton del pool
export const browserPool = new BrowserPool();
export default browserPool;
