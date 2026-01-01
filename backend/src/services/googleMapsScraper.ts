import puppeteer, { Browser, Page } from "puppeteer";
import antiDetection from "./antiDetection";
import cacheService from "./cacheService";
import {
  buildGridSearchUrl,
  calculateBoundingBox,
  createGrid,
  extractCoordsFromUrl,
  generateGridConfig,
} from "./gridSearchService";
import logger from "./logger";
import { googleMapsCircuitBreaker, withRetry } from "./retryService";
import scraperMetrics from "./scraperMetrics";

// Configuración avanzada
const CONFIG = {
  HEADLESS: true, // true = sin ventana, false = ver el navegador
  TIMEOUT: 30000,
  MAX_SCROLL_ATTEMPTS: 20, // Más intentos para zonas con muchos resultados
  MAX_CONCURRENT_TABS: 3, // Tabs paralelas para detalles
  RETRY_ATTEMPTS: 3,
  ENABLE_GRID_SEARCH: true, // Habilitar búsqueda por grilla para cubrir toda el área
  // Delays ahora son dinámicos desde antiDetection
};

// URLs de redes sociales que NO cuentan como "website real"
const SOCIAL_MEDIA_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "wa.me",
  "whatsapp.com",
  "t.me",
  "telegram.org",
  "pinterest.com",
];

// Sinónimos de categorías para filtrar relevancia
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  peluquería: [
    "peluquería",
    "barbería",
    "salon de belleza",
    "hair",
    "corte",
    "cabello",
    "estilista",
    "peluquero",
    "barbershop",
    "hairdresser",
  ],
  restaurante: [
    "restaurante",
    "restaurant",
    "comida",
    "food",
    "cocina",
    "gastronomía",
    "parrilla",
    "pizzería",
    "cafetería",
    "bar",
    "resto",
    "bodegón",
    "cervecería",
    "grill",
    "asador",
    "sushi",
    "hamburguesería",
    "pizza",
    "empanadas",
  ],
  restaurantes: [
    "restaurante",
    "restaurant",
    "comida",
    "food",
    "cocina",
    "gastronomía",
    "parrilla",
    "pizzería",
    "cafetería",
    "bar",
    "resto",
    "bodegón",
    "cervecería",
    "grill",
    "asador",
    "sushi",
    "hamburguesería",
    "pizza",
    "empanadas",
  ],
  dentista: [
    "dentista",
    "odontología",
    "dental",
    "odontólogo",
    "clínica dental",
    "consultorio dental",
  ],
  abogado: [
    "abogado",
    "abogados",
    "estudio jurídico",
    "legal",
    "law",
    "lawyer",
    "attorney",
    "bufete",
  ],
  veterinaria: [
    "veterinaria",
    "veterinario",
    "clínica veterinaria",
    "pet",
    "mascotas",
    "animal",
  ],
  gimnasio: [
    "gimnasio",
    "gym",
    "fitness",
    "crossfit",
    "entrenamiento",
    "training",
    "musculación",
    "pilates",
    "spinning",
    "funcional",
    "deportivo",
    "club",
  ],
  gimnasios: [
    "gimnasio",
    "gym",
    "fitness",
    "crossfit",
    "entrenamiento",
    "training",
    "musculación",
    "pilates",
    "spinning",
    "funcional",
    "deportivo",
    "club",
  ],
  inmobiliaria: [
    "inmobiliaria",
    "real estate",
    "propiedades",
    "bienes raíces",
    "inmuebles",
  ],
  "clínica estética": [
    "clínica estética",
    "estética",
    "belleza",
    "beauty",
    "spa",
    "tratamiento facial",
    "depilación",
  ],
  automotora: [
    "automotora",
    "autos",
    "cars",
    "concesionario",
    "vehículos",
    "car dealer",
  ],
  contador: [
    "contador",
    "contadora",
    "estudio contable",
    "contabilidad",
    "accountant",
  ],
};

// Categorías que siempre se excluyen (no relacionadas con negocios locales)
const EXCLUDED_CATEGORIES = [
  "cajero automático",
  "atm",
  "parada de autobús",
  "estación de servicio",
  "gasolinera",
  "estacionamiento",
  "parking",
];

export interface ScrapedPlace {
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount: number;
  priceLevel?: string;
  googleMapsUrl: string;
  latitude?: number;
  longitude?: number;
  placeId: string;
  businessHours?: string[];
  isOpen?: boolean;
  // Campos mejorados
  hasRealWebsite: boolean; // true si tiene web real (no red social)
  socialMediaUrl?: string; // URL de red social si no tiene web
  relevanceScore: number; // Score de relevancia con la búsqueda
  // Nuevos campos
  email?: string; // Email descubierto
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappNumber?: string;
}

export interface ScrapeOptions {
  keyword: string;
  location: string;
  maxResults?: number;
  language?: string;
  discoverEmails?: boolean; // Activar email discovery
  concurrentTabs?: number; // Tabs paralelas
  strictMatch?: boolean; // Solo resultados con coincidencia exacta (sin categorías relacionadas)
  forceRefresh?: boolean; // Ignorar caché y hacer scraping nuevo
}

export interface ScrapeStats {
  totalFound: number;
  totalProcessed: number;
  withPhone: number;
  withWebsite: number;
  withSocialMedia: number;
  avgRelevance: number;
  duration: number;
}

class GoogleMapsScraper {
  private browser: Browser | null = null;
  private currentKeyword: string = "";
  private sessionUserAgent: string = "";
  private sessionResolution: { width: number; height: number } = {
    width: 1920,
    height: 1080,
  };

  /**
   * Verificar si una URL es de red social (no cuenta como "website real")
   */
  private isSocialMediaUrl(url: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return SOCIAL_MEDIA_DOMAINS.some((domain) => lowerUrl.includes(domain));
  }

  /**
   * Extraer URLs específicas de redes sociales
   */
  private extractSocialUrls(website: string): {
    instagramUrl?: string;
    facebookUrl?: string;
    whatsappNumber?: string;
  } {
    const result: {
      instagramUrl?: string;
      facebookUrl?: string;
      whatsappNumber?: string;
    } = {};

    if (!website) return result;

    const lower = website.toLowerCase();

    if (lower.includes("instagram.com")) {
      result.instagramUrl = website;
    } else if (lower.includes("facebook.com") || lower.includes("fb.com")) {
      result.facebookUrl = website;
    } else if (lower.includes("wa.me") || lower.includes("whatsapp")) {
      const match = website.match(/[\d+]+/);
      if (match) result.whatsappNumber = match[0];
    }

    return result;
  }

  /**
   * Calcular score de relevancia entre la categoría y la keyword buscada
   */
  private calculateRelevanceScore(
    name: string,
    category: string,
    keyword: string
  ): number {
    const normalizedKeyword = keyword
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const normalizedCategory = category
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const normalizedName = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    let score = 0;

    // Coincidencia exacta en nombre = máxima relevancia
    if (normalizedName.includes(normalizedKeyword)) {
      score += 100;
    }

    // Coincidencia exacta en categoría
    if (normalizedCategory.includes(normalizedKeyword)) {
      score += 80;
    }

    // Buscar en sinónimos
    const synonyms = CATEGORY_SYNONYMS[normalizedKeyword] || [
      normalizedKeyword,
    ];
    for (const synonym of synonyms) {
      const normalizedSynonym = synonym
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalizedCategory.includes(normalizedSynonym)) {
        score += 60;
        break;
      }
      if (normalizedName.includes(normalizedSynonym)) {
        score += 40;
        break;
      }
    }

    // Buscar cualquier sinónimo de cualquier categoría en reversa
    // (si la categoría contiene algo de nuestro keyword)
    if (score === 0) {
      for (const [key, syns] of Object.entries(CATEGORY_SYNONYMS)) {
        const normalizedKey = key
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        // Si el keyword está relacionado con esta categoría
        if (
          normalizedKeyword.includes(normalizedKey) ||
          normalizedKey.includes(normalizedKeyword)
        ) {
          for (const syn of syns) {
            const normalizedSyn = syn
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            if (
              normalizedCategory.includes(normalizedSyn) ||
              normalizedName.includes(normalizedSyn)
            ) {
              score += 50;
              break;
            }
          }
          if (score > 0) break;
        }
      }
    }

    // Si aún no hay score, dar un score base mínimo de 20 para no filtrar todo
    // Los resultados vienen de Google Maps para esa búsqueda, así que tienen algo de relevancia
    if (score === 0) {
      score = 20;
    }

    // Penalizar categorías excluidas
    for (const excluded of EXCLUDED_CATEGORIES) {
      if (normalizedCategory.includes(excluded)) {
        score -= 100;
        break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Iniciar el navegador con configuración anti-detección
   */
  async init(): Promise<void> {
    if (this.browser) return;

    logger.info("🚀 Iniciando navegador Puppeteer con anti-detección...");

    // Generar configuración aleatoria para la sesión
    this.sessionUserAgent = antiDetection.getRandomUserAgent();
    this.sessionResolution = antiDetection.getRandomResolution();

    const proxy = antiDetection.getRandomProxy();
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      `--window-size=${this.sessionResolution.width},${this.sessionResolution.height}`,
      "--lang=es-AR",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ];

    // Agregar proxy si está configurado
    if (proxy) {
      launchArgs.push(
        `--proxy-server=${antiDetection.formatProxyForPuppeteer(proxy)}`
      );
      logger.info(`🔄 Usando proxy: ${proxy.host}:${proxy.port}`);
    }

    this.browser = await puppeteer.launch({
      headless: "new",
      args: launchArgs,
      defaultViewport: this.sessionResolution,
    });

    logger.info(
      `✅ Navegador iniciado | UA: ${this.sessionUserAgent.substring(0, 50)}...`
    );
  }

  /**
   * Cerrar el navegador
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info("🔒 Navegador cerrado");
    }
  }

  /**
   * Scrapear lugares de Google Maps con búsqueda por grilla dinámica
   * Cubre toda el área de la ciudad, no solo el centro
   */
  async scrapePlaces(options: ScrapeOptions): Promise<ScrapedPlace[]> {
    const {
      keyword,
      location,
      maxResults = 40,
      forceRefresh = false,
    } = options;
    const cacheKey = `scrape:${keyword}:${location}`.toLowerCase();
    const startTime = Date.now();

    // Guardar keyword para calcular relevancia
    this.currentKeyword = keyword;

    // Verificar circuit breaker
    if (googleMapsCircuitBreaker.isOpen()) {
      logger.warn("⚡ Circuit breaker abierto, esperando...");
      throw new Error(
        "Demasiados errores recientes, esperando para reintentar"
      );
    }

    // Si forceRefresh, limpiar caché para esta búsqueda
    if (forceRefresh) {
      await cacheService.delete(cacheKey);
      logger.info(`🔄 [FORCE REFRESH] Caché limpiado para: ${cacheKey}`);
    }

    // Verificar caché (solo si no es forceRefresh)
    if (!forceRefresh) {
      const cached = await cacheService.get<ScrapedPlace[]>(cacheKey);
      if (cached) {
        logger.info(`📦 Resultados desde caché: ${cached.length} lugares`);
        scraperMetrics.recordCacheHit();
        return cached;
      }
    }
    scraperMetrics.recordCacheMiss();

    await this.init();
    if (!this.browser) throw new Error("No se pudo iniciar el navegador");

    const page = await this.browser.newPage();
    const allPlaces: ScrapedPlace[] = [];
    const seenPlaceIds = new Set<string>();

    try {
      // Configuración anti-detección
      await page.setUserAgent(this.sessionUserAgent);
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
      });

      // PASO 1: Búsqueda inicial para obtener coordenadas del centro
      const searchQuery = encodeURIComponent(`${keyword} en ${location}`);
      const initialUrl = `https://www.google.com/maps/search/${searchQuery}`;

      logger.info(`🔍 [1/2] Búsqueda inicial: ${initialUrl}`);

      await withRetry(
        async () => {
          await page.goto(initialUrl, {
            waitUntil: "networkidle2",
            timeout: CONFIG.TIMEOUT,
          });
        },
        { maxRetries: CONFIG.RETRY_ATTEMPTS },
        "Navegación inicial a Google Maps"
      );

      await this.humanSleep();
      await this.acceptCookies(page);

      // Esperar a que se cargue y obtener coordenadas de la URL
      await this.sleep(2000);
      const currentUrl = page.url();
      const centerCoords = extractCoordsFromUrl(currentUrl);

      if (!centerCoords) {
        logger.warn(
          "⚠️ No se pudieron extraer coordenadas, usando búsqueda simple"
        );
        // Fallback a búsqueda simple si no hay coordenadas
        return this.scrapeSimple(
          page,
          options,
          allPlaces,
          seenPlaceIds,
          startTime,
          cacheKey
        );
      }

      logger.info(
        `📍 Centro detectado: ${centerCoords.lat.toFixed(
          4
        )}, ${centerCoords.lng.toFixed(4)}`
      );

      // PASO 2: Generar grilla de búsqueda dinámica
      const gridConfig = generateGridConfig(location);
      logger.info(
        `🗺️ Generando grilla ${gridConfig.gridSize}x${gridConfig.gridSize} (radio: ${gridConfig.radiusKm}km)`
      );

      const bbox = calculateBoundingBox(centerCoords, gridConfig.radiusKm);
      const gridCells = createGrid(bbox, gridConfig.gridSize);

      logger.info(
        `🔍 [2/2] Buscando en ${gridCells.length} celdas de la grilla...`
      );

      // Buscar en cada celda de la grilla
      for (
        let i = 0;
        i < gridCells.length && allPlaces.length < maxResults;
        i++
      ) {
        const cell = gridCells[i];
        const cellUrl = buildGridSearchUrl(keyword, cell);

        logger.info(
          `📍 [${i + 1}/${gridCells.length}] Celda ${cell.label} - zoom ${
            cell.zoom
          }`
        );

        try {
          await page.goto(cellUrl, {
            waitUntil: "networkidle2",
            timeout: CONFIG.TIMEOUT,
          });

          await this.humanSleep(1000, 2000);

          // Esperar el panel de resultados
          await page
            .waitForSelector('div[role="feed"]', { timeout: 8000 })
            .catch(() => {});

          // Scroll y recolectar
          const cellMaxResults =
            Math.ceil(
              (maxResults - allPlaces.length) / (gridCells.length - i)
            ) + 5;
          const scrolledPlaces = await this.scrollAndCollect(
            page,
            cellMaxResults
          );

          logger.debug(
            `   ↳ Encontrados ${scrolledPlaces.length} lugares en celda ${cell.label}`
          );

          // Obtener detalles de cada lugar nuevo
          for (const placeUrl of scrolledPlaces) {
            if (allPlaces.length >= maxResults) break;

            // Extraer placeId de la URL para evitar duplicados
            const placeIdMatch = placeUrl.match(/!1s([^!]+)/);
            const placeId = placeIdMatch ? placeIdMatch[1] : placeUrl;

            if (seenPlaceIds.has(placeId)) {
              continue;
            }
            seenPlaceIds.add(placeId);

            try {
              const details = await this.getPlaceDetails(
                page,
                placeUrl,
                allPlaces.length + 1,
                maxResults
              );

              if (details) {
                allPlaces.push(details);
                scraperMetrics.recordRequest({
                  url: placeUrl,
                  success: true,
                  duration: 0,
                });
                scraperMetrics.recordPlaceFound({
                  phone: details.phone,
                  website: details.website,
                  socialMediaUrl: details.socialMediaUrl,
                  relevanceScore: details.relevanceScore,
                });
              }

              await this.humanSleep(300, 800);
            } catch (error: any) {
              logger.warn(`⚠️ Error en lugar: ${error.message}`);
            }
          }

          // Delay entre celdas
          if (i < gridCells.length - 1) {
            await this.humanSleep(1500, 2500);
          }
        } catch (error: any) {
          logger.warn(`⚠️ Error en celda ${cell.label}: ${error.message}`);
        }
      }

      // Guardar en caché (1 día)
      if (allPlaces.length > 0) {
        await cacheService.set(cacheKey, allPlaces, 86400);
        googleMapsCircuitBreaker.recordSuccess();
      }

      // Filtrar por relevancia si strictMatch está activado
      let filteredPlaces = allPlaces;
      if (options.strictMatch) {
        const minRelevance = 60;
        filteredPlaces = allPlaces.filter(
          (p) => p.relevanceScore >= minRelevance
        );

        if (filteredPlaces.length < allPlaces.length) {
          logger.info(
            `🎯 Modo estricto: ${
              allPlaces.length - filteredPlaces.length
            } resultados filtrados por baja relevancia`
          );
        }
      }

      const totalDuration = Date.now() - startTime;
      logger.info(
        `✅ Scraping por grilla completado: ${
          filteredPlaces.length
        } lugares en ${(totalDuration / 1000).toFixed(1)}s`
      );
      scraperMetrics.logDetailedSummary();

      return filteredPlaces;
    } catch (error: any) {
      logger.error(`❌ Error en scraping: ${error.message}`);
      googleMapsCircuitBreaker.recordFailure();
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Scraping simple (fallback cuando no hay coordenadas)
   */
  private async scrapeSimple(
    page: Page,
    options: ScrapeOptions,
    places: ScrapedPlace[],
    seenPlaceIds: Set<string>,
    startTime: number,
    cacheKey: string
  ): Promise<ScrapedPlace[]> {
    const { maxResults = 40 } = options;

    // Esperar el panel de resultados
    await page
      .waitForSelector('div[role="feed"]', { timeout: 10000 })
      .catch(() => {
        logger.warn("⚠️ No se encontró el panel de resultados");
      });

    // Scroll para cargar más resultados
    const scrolledPlaces = await this.scrollAndCollect(page, maxResults);

    logger.info(
      `📍 Encontrados ${scrolledPlaces.length} lugares, obteniendo detalles...`
    );

    // Obtener detalles de cada lugar
    for (let i = 0; i < Math.min(scrolledPlaces.length, maxResults); i++) {
      try {
        const placeUrl = scrolledPlaces[i];
        const requestStart = Date.now();

        const details = await this.getPlaceDetails(
          page,
          placeUrl,
          i + 1,
          scrolledPlaces.length
        );

        const requestDuration = Date.now() - requestStart;

        if (details) {
          places.push(details);
          scraperMetrics.recordRequest({
            url: placeUrl,
            success: true,
            duration: requestDuration,
          });
          scraperMetrics.recordPlaceFound({
            phone: details.phone,
            website: details.website,
            socialMediaUrl: details.socialMediaUrl,
            relevanceScore: details.relevanceScore,
          });
        }

        await this.humanSleep(300, 800);

        if (antiDetection.shouldTakeLongPause()) {
          logger.debug("☕ Tomando pausa larga (comportamiento humano)");
          await this.sleep(antiDetection.getLongPauseDelay());
        }
      } catch (error: any) {
        logger.warn(`⚠️ Error en lugar ${i + 1}: ${error.message}`);
        scraperMetrics.recordRequest({
          url: scrolledPlaces[i],
          success: false,
          duration: 0,
          error: error.message,
        });
      }
    }

    // Guardar en caché
    if (places.length > 0) {
      await cacheService.set(cacheKey, places, 86400);
      googleMapsCircuitBreaker.recordSuccess();
    }

    // Filtrar por relevancia si strictMatch
    let filteredPlaces = places;
    if (options.strictMatch) {
      const minRelevance = 60;
      filteredPlaces = places.filter((p) => p.relevanceScore >= minRelevance);

      if (filteredPlaces.length < places.length) {
        logger.info(
          `🎯 Modo estricto: ${
            places.length - filteredPlaces.length
          } resultados filtrados`
        );
      }
    }

    const totalDuration = Date.now() - startTime;
    logger.info(
      `✅ Scraping simple completado: ${filteredPlaces.length} lugares en ${(
        totalDuration / 1000
      ).toFixed(1)}s`
    );
    scraperMetrics.logDetailedSummary();

    return filteredPlaces;
  }

  /**
   * Construir URL de búsqueda (legacy - para compatibilidad)
   */
  private buildSearchUrl(keyword: string, location: string): string {
    const searchQuery = encodeURIComponent(`${keyword} en ${location}`);
    return `https://www.google.com/maps/search/${searchQuery}`;
  }

  /**
   * Sleep con delay humanizado
   */
  private async humanSleep(
    min: number = 500,
    max: number = 2000
  ): Promise<void> {
    const delay = antiDetection.humanDelay(min, max);
    await this.sleep(delay);
  }

  /**
   * Aceptar cookies de Google
   */
  private async acceptCookies(page: Page): Promise<void> {
    try {
      const acceptButton = await page.$('button[aria-label*="Aceptar"]');
      if (acceptButton) {
        await this.humanSleep(200, 500); // Delay antes de click
        await acceptButton.click();
        await this.humanSleep(800, 1500);
        logger.debug("🍪 Cookies aceptadas");
      }
    } catch {
      // Ignorar si no hay popup
    }
  }

  /**
   * Hacer scroll y recolectar URLs de lugares
   */
  private async scrollAndCollect(
    page: Page,
    maxResults: number
  ): Promise<string[]> {
    const placeUrls: Set<string> = new Set();
    let scrollAttempts = 0;
    let lastCount = 0;
    let noNewResultsCount = 0;

    logger.info(
      `📜 Iniciando scroll para encontrar hasta ${maxResults} lugares...`
    );

    while (
      scrollAttempts < CONFIG.MAX_SCROLL_ATTEMPTS &&
      placeUrls.size < maxResults
    ) {
      // Obtener URLs de lugares visibles
      const urls = await page.evaluate(function () {
        var links = document.querySelectorAll('a[href*="/maps/place/"]');
        var result = [];
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute("href");
          if (href && href.includes("/maps/place/")) {
            result.push(href);
          }
        }
        return result;
      });

      urls.forEach((url) => placeUrls.add(url));

      if (placeUrls.size === lastCount) {
        noNewResultsCount++;
        scrollAttempts++;

        // Si después de 3 intentos sin nuevos resultados, probablemente llegamos al final
        if (noNewResultsCount >= 3) {
          logger.info(
            `📜 Fin de resultados alcanzado después de ${scrollAttempts} scrolls (${placeUrls.size} lugares)`
          );
          break;
        }
      } else {
        noNewResultsCount = 0;
        scrollAttempts = 0;
        lastCount = placeUrls.size;
      }

      // Scroll en el panel de resultados con comportamiento humano
      await page.evaluate(function () {
        var feed = document.querySelector('div[role="feed"]');
        if (feed) {
          // Scroll variable para parecer más humano
          var scrollAmount = 800 + Math.floor(Math.random() * 400);
          feed.scrollTop = feed.scrollTop + scrollAmount;
        }
      });

      // Delay humanizado entre scrolls
      await this.humanSleep(800, 1500);
      logger.debug(
        `📜 Scroll ${scrollAttempts + 1}: ${placeUrls.size} lugares encontrados`
      );
    }

    logger.info(
      `📜 Scroll completado: ${placeUrls.size} lugares únicos encontrados`
    );
    return Array.from(placeUrls).slice(0, maxResults);
  }

  /**
   * Obtener detalles de un lugar específico
   */
  private async getPlaceDetails(
    page: Page,
    url: string,
    index: number,
    total: number
  ): Promise<ScrapedPlace | null> {
    try {
      logger.debug(`⚙️ [${index}/${total}] Obteniendo detalles...`);

      // Navegar con reintento
      await withRetry(
        async () => {
          await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: CONFIG.TIMEOUT,
          });
        },
        { maxRetries: 2 },
        `Navegación a lugar ${index}`
      );

      await this.humanSleep(1000, 2000);

      // Extraer datos del lugar - usando function() para evitar __name error de esbuild
      const data = await page.evaluate(function () {
        // Nombre del negocio
        var name = "";
        var h1Large = document.querySelector('h1[class*="fontHeadlineLarge"]');
        var h1Header = document.querySelector('h1[class*="header"]');
        var h1Plain = document.querySelector("h1");
        if (h1Large && h1Large.textContent) name = h1Large.textContent.trim();
        else if (h1Header && h1Header.textContent)
          name = h1Header.textContent.trim();
        else if (h1Plain && h1Plain.textContent)
          name = h1Plain.textContent.trim();

        // Categoría
        var category = "";
        var catBtn = document.querySelector('button[jsaction*="category"]');
        var catSpan = document.querySelector('span[class*="fontBodyMedium"]');
        if (catBtn && catBtn.textContent) category = catBtn.textContent.trim();
        else if (catSpan && catSpan.textContent)
          category = catSpan.textContent.trim();

        // Dirección
        var addressButton = document.querySelector(
          'button[data-item-id="address"]'
        );
        var address = "";
        if (addressButton && addressButton.textContent)
          address = addressButton.textContent.trim();

        // Teléfono
        var phoneButton = document.querySelector(
          'button[data-item-id^="phone:"]'
        );
        var phone = "";
        if (phoneButton) {
          var phoneAttr = phoneButton.getAttribute("data-item-id");
          if (phoneAttr) phone = phoneAttr.replace("phone:tel:", "");
        }

        // Website
        var websiteButton = document.querySelector(
          'a[data-item-id="authority"]'
        );
        var website = "";
        if (websiteButton) {
          var hrefAttr = websiteButton.getAttribute("href");
          if (hrefAttr) website = hrefAttr;
        }

        // Rating
        var ratingEl = document.querySelector('div[class*="fontDisplayLarge"]');
        var rating = null;
        if (ratingEl && ratingEl.textContent) {
          var ratingText = ratingEl.textContent.replace(",", ".");
          var parsed = parseFloat(ratingText);
          if (!isNaN(parsed)) rating = parsed;
        }

        // Reviews
        var reviewsEl = document.querySelector(
          'span[aria-label*="opiniones"], span[aria-label*="reviews"]'
        );
        var reviewCount = 0;
        if (reviewsEl) {
          var reviewsText = reviewsEl.getAttribute("aria-label") || "";
          var reviewsMatch = reviewsText.match(/[\d.,]+/);
          if (reviewsMatch) {
            reviewCount = parseInt(reviewsMatch[0].replace(/[.,]/g, "")) || 0;
          }
        }

        // Horarios
        var hoursButton = document.querySelector(
          'button[data-item-id*="hour"]'
        );
        var isOpen = false;
        if (hoursButton && hoursButton.textContent) {
          isOpen =
            hoursButton.textContent.toLowerCase().indexOf("abierto") !== -1;
        }

        // Coordenadas desde la URL
        var urlMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        var latitude = urlMatch ? parseFloat(urlMatch[1]) : null;
        var longitude = urlMatch ? parseFloat(urlMatch[2]) : null;

        // Place ID desde la URL
        var placeIdMatch = window.location.href.match(/!1s([^!]+)/);
        var placeId = placeIdMatch ? placeIdMatch[1] : "place_" + Date.now();

        return {
          name: name,
          category: category,
          address: address,
          phone: phone,
          website: website,
          rating: rating,
          reviewCount: reviewCount,
          isOpen: isOpen,
          latitude: latitude,
          longitude: longitude,
          placeId: placeId,
          googleMapsUrl: window.location.href,
        };
      });

      if (!data.name) {
        logger.warn(`⚠️ Sin nombre, saltando...`);
        return null;
      }

      // Verificar si el website es una red social
      const isSocialMedia = this.isSocialMediaUrl(data.website || "");
      const hasRealWebsite = !!data.website && !isSocialMedia;

      // Extraer URLs específicas de redes sociales
      const socialUrls = this.extractSocialUrls(data.website || "");

      // Calcular relevancia
      const relevanceScore = this.calculateRelevanceScore(
        data.name,
        data.category || "",
        this.currentKeyword
      );

      // Log mejorado con más info
      const webStatus = hasRealWebsite ? "🌐" : isSocialMedia ? "📱" : "❌";
      const phoneStatus = data.phone ? "📞" : "—";
      logger.info(
        `✨ ${data.name} | ⭐${
          data.rating || "N/A"
        } | ${phoneStatus} | ${webStatus} | Rel:${relevanceScore}`
      );

      return {
        name: data.name,
        category: data.category || "Negocio",
        address: data.address,
        phone: data.phone || undefined,
        website: hasRealWebsite ? data.website : undefined,
        rating: data.rating ?? undefined,
        reviewCount: data.reviewCount,
        isOpen: data.isOpen,
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        placeId: data.placeId,
        googleMapsUrl: data.googleMapsUrl,
        hasRealWebsite,
        socialMediaUrl: isSocialMedia ? data.website : undefined,
        relevanceScore,
        // Nuevos campos de redes sociales
        instagramUrl: socialUrls.instagramUrl,
        facebookUrl: socialUrls.facebookUrl,
        whatsappNumber: socialUrls.whatsappNumber,
      };
    } catch (error: any) {
      logger.warn(`⚠️ Error obteniendo detalles: ${error.message}`);
      return null;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
export const googleMapsScraper = new GoogleMapsScraper();
export default googleMapsScraper;
