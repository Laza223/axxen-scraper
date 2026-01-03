import puppeteer, { Browser, Page } from "puppeteer";
import antiDetection from "./antiDetection";
import { browserPool } from "./browserPool";
import businessCategorizationService from "./businessCategorizationService";
import cacheService from "./cacheService";
import duplicateDetectionService from "./duplicateDetectionService";
import {
  buildGridSearchUrl,
  calculateBoundingBox,
  createGrid,
  estimateCitySize,
  extractCoordsFromUrl,
  generateGridConfig,
  gridSearchService,
} from "./gridSearchService";
import leadQualityScoringService from "./leadQualityScoringService";
import logger from "./logger";
import retryQueueService from "./retryQueueService";
import { googleMapsCircuitBreaker, withRetry } from "./retryService";
import scraperMetrics from "./scraperMetrics";
import synonymService from "./synonymService";
import zoneSaturationService from "./zoneSaturationService";

// Configuración avanzada
const CONFIG = {
  HEADLESS: true, // true = sin ventana, false = ver el navegador
  TIMEOUT: 45000, // ⬆️ Aumentado para provincias grandes
  MAX_SCROLL_ATTEMPTS: 80, // ⬆️ Aumentado para obtener más resultados
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

// Dominios de directorios/plataformas que NO cuentan como website propio
const DIRECTORY_DOMAINS = [
  // Directorios internacionales
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "trustpilot.com",
  "yellowpages.com",
  "manta.com",
  "hotfrog.com",
  // Inmobiliarias Argentina
  "argenprop.com",
  "zonaprop.com",
  "properati.com.ar",
  "inmuebles.clarin.com",
  "remax.com.ar",
  "century21.com.ar",
  "inmobusqueda.com.ar",
  "cabaprop.com.ar",
  "mudafy.com.ar",
  // Clasificados
  "mercadolibre.com.ar",
  "mercadolibre.com",
  "olx.com.ar",
  "olx.com",
  "alamaula.com",
  "segundamano.com",
  // Gastronómicos
  "restorando.com.ar",
  "pedidosya.com",
  "rappi.com.ar",
  "glovo.com",
  // Salud
  "doctoralia.com.ar",
  // Autos
  "autocosmos.com.ar",
  "demotores.com.ar",
  "kavak.com",
  // Directorios genéricos
  "paginasamarillas.com",
  "paginasamarillas.com.ar",
  "guiaoleo.com.ar",
  "cylex.com.ar",
  "infobel.com",
  "tupalo.com",
  "locanto.com.ar",
  // Plataformas de webs gratuitas (no son web propias)
  "wix.com",
  "weebly.com",
  "sites.google.com",
  "wordpress.com",
  "blogspot.com",
  "tumblr.com",
  "carrd.co",
  "linktree.com",
  "linktr.ee",
  "bio.link",
  "beacons.ai",
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
  // 🆕 Campos de calidad y categorización
  qualityScore?: number; // 0-100 score de calidad del lead
  qualityGrade?: "A" | "B" | "C" | "D" | "F"; // Calificación
  businessSize?: "franchise" | "chain" | "local" | "independent" | "unknown";
  businessType?: string; // Tipo de negocio detectado
  chainName?: string; // Nombre de la cadena si es franquicia
  searchCity?: string; // 🆕 Ciudad donde se encontró (para búsquedas provinciales)
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
  // 🆕 Nuevas opciones
  useSynonyms?: boolean; // Usar sinónimos para expandir búsqueda
  deduplicateResults?: boolean; // Deduplicar resultados inteligentemente
  calculateQualityScore?: boolean; // Calcular score de calidad
  categorizeBusinesses?: boolean; // Categorizar tipo de negocio
  excludeFranchises?: boolean; // Excluir franquicias conocidas
  minQualityScore?: number; // Score mínimo de calidad (0-100)
}

export interface ScrapeStats {
  totalFound: number;
  totalProcessed: number;
  withPhone: number;
  withWebsite: number;
  withSocialMedia: number;
  avgRelevance: number;
  duration: number;
  // 🆕 Nuevas estadísticas
  duplicatesRemoved?: number;
  averageQualityScore?: number;
  byBusinessSize?: Record<string, number>;
}

class GoogleMapsScraper {
  private browser: Browser | null = null;
  private currentInstanceId: string | null = null; // 🆕 Para el browserPool
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
   * Verificar si una URL es de un directorio/plataforma (no es website propio)
   */
  private isDirectoryUrl(url: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return DIRECTORY_DOMAINS.some((domain) => lowerUrl.includes(domain));
  }

  /**
   * Verificar si una URL es un website REAL del negocio
   * Debe tener dominio propio, no ser red social ni directorio
   */
  private isRealBusinessWebsite(url: string): boolean {
    if (!url) return false;

    // No es red social
    if (this.isSocialMediaUrl(url)) return false;

    // No es directorio/plataforma
    if (this.isDirectoryUrl(url)) return false;

    // Tiene que ser una URL válida
    try {
      const urlObj = new URL(url);
      // Debe tener un dominio real (no localhost, no IP)
      if (urlObj.hostname === "localhost") return false;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(urlObj.hostname)) return false;

      return true;
    } catch {
      return false;
    }
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
   * 🆕 MEJORADO: Usa browserPool para reutilizar navegadores
   */
  async init(): Promise<void> {
    if (this.browser) return;

    logger.info("🚀 Inicializando navegador desde browserPool...");

    try {
      // 🆕 Usar el browserPool para obtener un navegador reutilizable
      await browserPool.initialize();

      const { browser, instanceId, userAgent } = await browserPool.acquire();

      this.browser = browser;
      this.currentInstanceId = instanceId;
      this.sessionUserAgent = userAgent;
      this.sessionResolution = antiDetection.getRandomResolution();

      logger.info(
        `✅ Navegador obtenido del pool (${instanceId}) | UA: ${this.sessionUserAgent.substring(
          0,
          50
        )}...`
      );
    } catch (error) {
      logger.warn(
        `⚠️ browserPool falló, usando fallback: ${(error as Error).message}`
      );

      // Fallback: crear navegador directamente
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
        "--disable-extensions",
        "--disable-plugins",
        "--disable-popup-blocking",
        "--ignore-certificate-errors",
        "--no-first-run",
        "--no-default-browser-check",
      ];

      if (proxy) {
        launchArgs.push(
          `--proxy-server=${antiDetection.formatProxyForPuppeteer(proxy)}`
        );
      }

      this.browser = await puppeteer.launch({
        headless: "new",
        args: launchArgs,
        defaultViewport: this.sessionResolution,
      });

      this.currentInstanceId = null; // No es del pool
      logger.info(`✅ Navegador fallback iniciado`);
    }
  }

  /**
   * Cerrar/liberar el navegador
   * 🆕 MEJORADO: Libera al pool en lugar de cerrar
   */
  async close(): Promise<void> {
    if (this.browser) {
      if (this.currentInstanceId) {
        // 🆕 Si viene del pool, solo liberarlo (no cerrarlo)
        await browserPool.release(this.currentInstanceId);
        logger.info(
          `🔄 Navegador liberado al pool (${this.currentInstanceId})`
        );
      } else {
        // Si es fallback, cerrarlo normalmente
        await this.browser.close();
        logger.info("🔒 Navegador fallback cerrado");
      }
      this.browser = null;
      this.currentInstanceId = null;
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
      maxResults = 100,
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
      // Event handler para detectar si la página se cierra
      page.on("close", () => {
        logger.warn("⚠️ La página fue cerrada inesperadamente");
      });

      page.on("error", (err) => {
        logger.error(`❌ Error en la página: ${err.message}`);
      });

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
      await this.sleep(3000); // Más tiempo para que cargue

      // Verificar si hay bloqueo o CAPTCHA
      const pageContent = await page.content();
      if (
        pageContent.includes("unusual traffic") ||
        pageContent.includes("captcha") ||
        pageContent.includes("sorry")
      ) {
        logger.warn("⚠️ Google detectó tráfico inusual, esperando...");
        await this.sleep(10000); // Esperar 10 segundos
        await page.reload({ waitUntil: "networkidle2" });
        await this.sleep(3000);
      }

      const currentUrl = page.url();
      logger.debug(`📍 URL actual: ${currentUrl}`);
      const centerCoords = extractCoordsFromUrl(currentUrl);

      // 🆕 Detectar si es una búsqueda provincial/regional
      const locationSize = estimateCitySize(location);
      const isProvincialSearch =
        locationSize === "province" || locationSize === "region";

      if (isProvincialSearch) {
        logger.info(
          `🗺️ Detectada búsqueda PROVINCIAL/REGIONAL: ${locationSize}`
        );
        // Usar búsqueda por ciudades principales
        return this.scrapeProvincial(
          page,
          options,
          allPlaces,
          seenPlaceIds,
          startTime,
          cacheKey
        );
      }

      if (!centerCoords) {
        logger.warn(
          "⚠️ No se pudieron extraer coordenadas, usando búsqueda simple"
        );

        // Esperar un poco más antes del fallback
        await this.sleep(2000);

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
      const bbox = calculateBoundingBox(centerCoords, gridConfig.radiusKm);
      const gridCells = createGrid(bbox, gridConfig.gridSize);

      logger.info(
        `🗺️ Grilla ${gridConfig.gridSize}x${gridConfig.gridSize} = ${gridCells.length} celdas | ` +
          `Radio: ${gridConfig.radiusKm}km | ` +
          `Área: ${(gridConfig.radiusKm * 2).toFixed(0)}km x ${(
            gridConfig.radiusKm * 2
          ).toFixed(0)}km`
      );
      logger.info(
        `📍 Cubriendo desde (${bbox.south.toFixed(4)}, ${bbox.west.toFixed(
          4
        )}) ` + `hasta (${bbox.north.toFixed(4)}, ${bbox.east.toFixed(4)})`
      );

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
          `📍 [${i + 1}/${gridCells.length}] Celda ${
            cell.label
          } (${cell.center.lat.toFixed(4)}, ${cell.center.lng.toFixed(
            4
          )}) - zoom ${cell.zoom}`
        );

        try {
          // Navegar a las coordenadas de la celda
          await page.goto(cellUrl, {
            waitUntil: "networkidle2",
            timeout: CONFIG.TIMEOUT,
          });

          await this.humanSleep(1500, 2500);

          // 🆕 MEJORADO: Forzar "Buscar en esta área" con múltiples estrategias
          // Esto es CRÍTICO para obtener resultados de la nueva ubicación
          const searchInAreaSuccess = await this.moveMapAndSearch(
            page,
            cell.center.lat,
            cell.center.lng,
            keyword
          );

          if (!searchInAreaSuccess) {
            logger.warn(
              `   ⚠️ No se pudo forzar actualización en celda ${cell.label}, usando resultados disponibles`
            );
          }

          // Esperar el panel de resultados
          await page
            .waitForSelector('div[role="feed"]', { timeout: 10000 })
            .catch(() => {});

          // Scroll y recolectar (ahora con más resultados esperados)
          const cellMaxResults =
            Math.ceil(
              (maxResults - allPlaces.length) / (gridCells.length - i)
            ) + 10; // +10 en lugar de +5 para aprovechar el "Buscar en esta área"
          const scrolledPlaces = await this.scrollAndCollect(
            page,
            cellMaxResults
          );

          logger.info(
            `   ↳ Encontrados ${scrolledPlaces.length} lugares en celda ${cell.label}`
          );

          // 🆕 PARALELIZADO: Filtrar URLs nuevas primero
          const newPlaceUrls: { url: string; placeId: string }[] = [];
          for (const placeUrl of scrolledPlaces) {
            if (allPlaces.length + newPlaceUrls.length >= maxResults) break;

            const placeIdMatch = placeUrl.match(/!1s([^!]+)/);
            const placeId = placeIdMatch ? placeIdMatch[1] : placeUrl;

            if (!seenPlaceIds.has(placeId)) {
              seenPlaceIds.add(placeId);
              newPlaceUrls.push({ url: placeUrl, placeId });
            }
          }

          // 🆕 PARALELIZADO: Procesar lugares en batches de 3
          const BATCH_SIZE = 3;
          for (
            let batch = 0;
            batch < newPlaceUrls.length;
            batch += BATCH_SIZE
          ) {
            if (allPlaces.length >= maxResults) break;

            const batchUrls = newPlaceUrls.slice(batch, batch + BATCH_SIZE);

            // Procesar batch en paralelo
            const batchResults = await Promise.all(
              batchUrls.map(async ({ url: placeUrl }, batchIndex) => {
                try {
                  const details = await this.getPlaceDetails(
                    page,
                    placeUrl,
                    allPlaces.length + batchIndex + 1,
                    maxResults
                  );
                  return { details, placeUrl, success: true };
                } catch (error: any) {
                  logger.warn(`⚠️ Error en lugar: ${error.message}`);
                  return { details: null, placeUrl, success: false };
                }
              })
            );

            // Agregar resultados exitosos
            for (const { details, placeUrl } of batchResults) {
              if (details && allPlaces.length < maxResults) {
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
            }

            // Pequeño delay entre batches (⚡ reducido)
            if (batch + BATCH_SIZE < newPlaceUrls.length) {
              await this.humanSleep(100, 200);
            }
          }

          // Delay entre celdas (⚡ reducido de 1.5-2.5s a 0.8-1.2s)
          if (i < gridCells.length - 1) {
            await this.humanSleep(800, 1200);
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

      // 🆕 POST-PROCESAMIENTO AVANZADO
      let processedPlaces = allPlaces;

      // 1. Deduplicación inteligente
      if (options.deduplicateResults !== false) {
        const dedupeResult =
          duplicateDetectionService.deduplicate(processedPlaces);
        if (dedupeResult.stats.removed > 0) {
          logger.info(
            `🔍 Deduplicación: ${dedupeResult.stats.removed} duplicados removidos`
          );
        }
        processedPlaces = dedupeResult.unique;
      }

      // 2. Calcular score de calidad para cada lugar
      if (options.calculateQualityScore !== false) {
        processedPlaces = processedPlaces.map((place) => {
          const scoreResult = leadQualityScoringService.calculateScore({
            name: place.name,
            website: place.website,
            hasRealWebsite: place.hasRealWebsite,
            email: place.email,
            phone: place.phone,
            address: place.address,
            rating: place.rating,
            reviewCount: place.reviewCount,
            instagramUrl: place.instagramUrl,
            facebookUrl: place.facebookUrl,
            businessHours: place.businessHours,
          });
          return {
            ...place,
            qualityScore: scoreResult.score,
            qualityGrade: scoreResult.grade,
          };
        });
      }

      // 3. Categorizar tipo de negocio
      if (options.categorizeBusinesses !== false) {
        processedPlaces = processedPlaces.map((place) => {
          const catResult = businessCategorizationService.categorize({
            name: place.name,
            category: place.category,
            address: place.address,
            website: place.website,
            phone: place.phone,
            reviewCount: place.reviewCount,
            rating: place.rating,
          });
          return {
            ...place,
            businessSize: catResult.businessSize,
            businessType: catResult.businessType,
            chainName: catResult.chainName,
          };
        });
      }

      // 4. Excluir franquicias si se solicita
      if (options.excludeFranchises) {
        const beforeCount = processedPlaces.length;
        processedPlaces = processedPlaces.filter(
          (p) => p.businessSize !== "franchise" && p.businessSize !== "chain"
        );
        if (processedPlaces.length < beforeCount) {
          logger.info(
            `🏢 Franquicias excluidas: ${beforeCount - processedPlaces.length}`
          );
        }
      }

      // 5. Filtrar por score mínimo de calidad
      if (options.minQualityScore && options.minQualityScore > 0) {
        const beforeCount = processedPlaces.length;
        processedPlaces = processedPlaces.filter(
          (p) => (p.qualityScore || 0) >= options.minQualityScore!
        );
        if (processedPlaces.length < beforeCount) {
          logger.info(
            `🏆 Filtro de calidad (min ${options.minQualityScore}): ${
              beforeCount - processedPlaces.length
            } excluidos`
          );
        }
      }

      // 6. Filtrar por relevancia si strictMatch está activado
      if (options.strictMatch) {
        const minRelevance = 60;
        const beforeCount = processedPlaces.length;
        processedPlaces = processedPlaces.filter(
          (p) => p.relevanceScore >= minRelevance
        );

        if (processedPlaces.length < beforeCount) {
          logger.info(
            `🎯 Modo estricto: ${
              beforeCount - processedPlaces.length
            } resultados filtrados por baja relevancia`
          );
        }
      }

      // 7. Ordenar por calidad (mayor primero)
      processedPlaces.sort(
        (a, b) => (b.qualityScore || 0) - (a.qualityScore || 0)
      );

      const totalDuration = Date.now() - startTime;

      // Log resumen de calidad
      const qualitySummary = leadQualityScoringService.getQualitySummary(
        processedPlaces.map((p) => ({
          name: p.name,
          website: p.website,
          hasRealWebsite: p.hasRealWebsite,
          email: p.email,
          phone: p.phone,
          address: p.address,
          rating: p.rating,
          reviewCount: p.reviewCount,
        }))
      );

      logger.info(
        `✅ Scraping completado: ${processedPlaces.length} lugares en ${(
          totalDuration / 1000
        ).toFixed(1)}s`
      );
      logger.info(
        `📊 Calidad promedio: ${qualitySummary.averageScore} | ` +
          `A:${qualitySummary.gradeDistribution.A} B:${qualitySummary.gradeDistribution.B} ` +
          `C:${qualitySummary.gradeDistribution.C} D:${qualitySummary.gradeDistribution.D} F:${qualitySummary.gradeDistribution.F}`
      );
      scraperMetrics.logDetailedSummary();

      // 🆕 CHEQUEO DE SATURACIÓN DE ZONA
      const duplicatesRemoved = allPlaces.length - processedPlaces.length;
      const saturationResult = zoneSaturationService.checkSaturation(
        keyword,
        location,
        processedPlaces.length,
        duplicatesRemoved + seenPlaceIds.size - allPlaces.length // Duplicados totales
      );

      if (saturationResult.isSaturated) {
        logger.warn(`\n${saturationResult.recommendation}`);
        if (
          saturationResult.suggestedZones &&
          saturationResult.suggestedZones.length > 0
        ) {
          logger.info(
            `💡 Zonas sugeridas: ${saturationResult.suggestedZones.join(", ")}`
          );
        }
      }

      return processedPlaces;
    } catch (error: any) {
      logger.error(`❌ Error en scraping: ${error.message}`);
      googleMapsCircuitBreaker.recordFailure();

      // Devolver lo que tengamos en lugar de crashear
      if (allPlaces.length > 0) {
        logger.info(
          `📦 Devolviendo ${allPlaces.length} lugares parciales a pesar del error`
        );
        return allPlaces;
      }

      // Si no tenemos nada, devolver array vacío en lugar de crashear
      return [];
    } finally {
      try {
        if (page && !page.isClosed()) {
          await page.close();
        }
      } catch {
        // Ignorar errores al cerrar la página
      }
    }
  }

  /**
   * 🆕 Búsqueda expandida con sinónimos
   * Realiza múltiples búsquedas con variantes del término y consolida resultados
   * MEJORADO: Usa más sinónimos y busca más resultados por término
   */
  async scrapePlacesWithSynonyms(
    options: ScrapeOptions
  ): Promise<ScrapedPlace[]> {
    const { keyword, location, maxResults = 100 } = options;
    const startTime = Date.now();

    // Obtener sinónimos para el término de búsqueda
    const synonyms = synonymService.getSynonyms(keyword);

    // ⚡ OPTIMIZADO: Máximo 4 sinónimos para velocidad (antes era 10)
    const maxSynonyms = Math.min(4, synonyms.length);
    const searchTerms = synonyms.slice(0, maxSynonyms);

    if (searchTerms.length <= 1) {
      // Sin sinónimos, hacer búsqueda normal
      logger.info(`🔍 Búsqueda sin sinónimos: "${keyword}"`);
      return this.scrapePlaces(options);
    }

    logger.info(
      `🔄 Búsqueda expandida con ${
        searchTerms.length
      } variantes: ${searchTerms.join(", ")}`
    );

    const allResults: ScrapedPlace[] = [];
    const seenPlaceIds = new Set<string>();

    // ⚡ OPTIMIZADO: Buscar 1.3x más resultados (antes era 2.5x que era excesivo)
    const basePerTerm = Math.ceil(maxResults / searchTerms.length);
    const resultsPerTerm = Math.ceil(basePerTerm * 1.3);

    logger.info(
      `📊 Estrategia: ${resultsPerTerm} resultados por cada ${searchTerms.length} términos`
    );

    // Realizar búsqueda por cada sinónimo
    for (
      let i = 0;
      i < searchTerms.length && allResults.length < maxResults;
      i++
    ) {
      const term = searchTerms[i];
      const remainingNeeded = maxResults - allResults.length;

      // Si ya tenemos suficientes, terminar
      if (remainingNeeded <= 0) {
        logger.info(
          `✅ Objetivo de ${maxResults} leads alcanzado, terminando búsqueda de sinónimos`
        );
        break;
      }

      // Ajustar cuántos buscar según lo que falta
      const toSearch = Math.max(
        resultsPerTerm,
        Math.ceil(remainingNeeded * 1.3)
      );

      logger.info(
        `🔍 [${i + 1}/${
          searchTerms.length
        }] Buscando: "${term} en ${location}" (objetivo: ${toSearch})`
      );

      try {
        const results = await this.scrapePlaces({
          ...options,
          keyword: term,
          maxResults: toSearch,
          // Desactivar procesamiento individual, lo haremos al final
          deduplicateResults: false,
          calculateQualityScore: false,
          categorizeBusinesses: false,
        });

        // Agregar solo los que no hemos visto
        for (const place of results) {
          if (!seenPlaceIds.has(place.placeId)) {
            seenPlaceIds.add(place.placeId);
            allResults.push(place);
          }
        }

        logger.info(
          `   ↳ Encontrados: ${results.length} (únicos totales: ${allResults.length})`
        );

        // ⚡ OPTIMIZADO: Early exit si ya tenemos suficientes
        if (allResults.length >= maxResults) {
          logger.info(
            `✅ Ya tenemos ${allResults.length}/${maxResults} leads, terminando`
          );
          break;
        }

        // Delay entre búsquedas (reducido de 3-5s a 1-2s)
        if (i < searchTerms.length - 1) {
          await this.sleep(1000 + Math.random() * 1000);
        }
      } catch (error: any) {
        logger.warn(`⚠️ Error en búsqueda "${term}": ${error.message}`);
        // Agregar a cola de reintentos
        retryQueueService.enqueue(
          "grid_cell",
          { keyword: term, location },
          {
            error: error.message,
            priority: "normal",
          }
        );
      }
    }

    // Aplicar post-procesamiento a todos los resultados
    let processedPlaces = allResults;

    // Deduplicación inteligente
    const dedupeResult = duplicateDetectionService.deduplicate(processedPlaces);
    if (dedupeResult.stats.removed > 0) {
      logger.info(
        `🔍 Deduplicación final: ${dedupeResult.stats.removed} duplicados removidos`
      );
    }
    processedPlaces = dedupeResult.unique;

    // Calcular score de calidad
    processedPlaces = processedPlaces.map((place) => {
      const scoreResult = leadQualityScoringService.calculateScore({
        name: place.name,
        website: place.website,
        hasRealWebsite: place.hasRealWebsite,
        email: place.email,
        phone: place.phone,
        address: place.address,
        rating: place.rating,
        reviewCount: place.reviewCount,
        instagramUrl: place.instagramUrl,
        facebookUrl: place.facebookUrl,
        businessHours: place.businessHours,
      });
      return {
        ...place,
        qualityScore: scoreResult.score,
        qualityGrade: scoreResult.grade,
      };
    });

    // Categorizar negocios
    processedPlaces = processedPlaces.map((place) => {
      const catResult = businessCategorizationService.categorize({
        name: place.name,
        category: place.category,
        address: place.address,
        website: place.website,
        phone: place.phone,
        reviewCount: place.reviewCount,
        rating: place.rating,
      });
      return {
        ...place,
        businessSize: catResult.businessSize,
        businessType: catResult.businessType,
        chainName: catResult.chainName,
      };
    });

    // Excluir franquicias si se solicita
    if (options.excludeFranchises) {
      const beforeCount = processedPlaces.length;
      processedPlaces = processedPlaces.filter(
        (p) => p.businessSize !== "franchise" && p.businessSize !== "chain"
      );
      if (processedPlaces.length < beforeCount) {
        logger.info(
          `🏢 Franquicias excluidas: ${beforeCount - processedPlaces.length}`
        );
      }
    }

    // Filtrar por score mínimo
    if (options.minQualityScore && options.minQualityScore > 0) {
      const beforeCount = processedPlaces.length;
      processedPlaces = processedPlaces.filter(
        (p) => (p.qualityScore || 0) >= options.minQualityScore!
      );
      if (processedPlaces.length < beforeCount) {
        logger.info(
          `🏆 Filtro de calidad: ${
            beforeCount - processedPlaces.length
          } excluidos`
        );
      }
    }

    // Ordenar por calidad
    processedPlaces.sort(
      (a, b) => (b.qualityScore || 0) - (a.qualityScore || 0)
    );

    // Limitar a maxResults
    if (processedPlaces.length > maxResults) {
      processedPlaces = processedPlaces.slice(0, maxResults);
    }

    const totalDuration = Date.now() - startTime;
    logger.info(
      `✅ Búsqueda expandida completada: ${
        processedPlaces.length
      } lugares únicos en ${(totalDuration / 1000).toFixed(1)}s`
    );

    return processedPlaces;
  }

  /**
   * 🆕 Scraping PROVINCIAL - busca en ciudades principales de la provincia
   * Útil para búsquedas a nivel de provincia entera
   */
  private async scrapeProvincial(
    page: Page,
    options: ScrapeOptions,
    places: ScrapedPlace[],
    seenPlaceIds: Set<string>,
    startTime: number,
    cacheKey: string
  ): Promise<ScrapedPlace[]> {
    const { keyword, location, maxResults = 100 } = options;

    // Obtener las ciudades a buscar usando el servicio de grilla
    const gridSearch = await gridSearchService.prepareGridSearch(
      keyword,
      location,
      {
        maxCells: 30, // Máximo 30 ciudades para no exceder tiempos
      }
    );

    logger.info(
      `🏙️ Búsqueda provincial: ${gridSearch.urls.length} ciudades a buscar`
    );

    const allPlaces: ScrapedPlace[] = [...places];
    let citiesSearched = 0;

    // Buscar en cada ciudad
    for (
      let i = 0;
      i < gridSearch.urls.length && allPlaces.length < maxResults;
      i++
    ) {
      const cityUrl = gridSearch.urls[i];
      const cityLabel = gridSearch.cells[i]?.label || `Ciudad ${i + 1}`;

      logger.info(
        `🏙️ [${i + 1}/${gridSearch.urls.length}] Buscando en: ${cityLabel}`
      );

      try {
        // Navegar a la búsqueda de esta ciudad
        await page.goto(cityUrl, {
          waitUntil: "networkidle2",
          timeout: CONFIG.TIMEOUT,
        });

        await this.humanSleep(2000, 3000);

        // Verificar si hay bloqueo
        const pageContent = await page.content().catch(() => "");
        if (
          pageContent.includes("unusual traffic") ||
          pageContent.includes("captcha")
        ) {
          logger.warn(`⚠️ Bloqueo detectado en ${cityLabel}, esperando...`);
          await this.sleep(10000);
          continue;
        }

        // Esperar el panel de resultados
        await page
          .waitForSelector('div[role="feed"]', { timeout: 10000 })
          .catch(() => {});

        // Calcular cuántos resultados necesitamos de esta ciudad
        const remainingNeeded = maxResults - allPlaces.length;
        const perCityTarget =
          Math.ceil(remainingNeeded / (gridSearch.urls.length - i)) + 5;

        // Scroll y recolectar
        const scrolledPlaces = await this.scrollAndCollect(page, perCityTarget);

        logger.info(
          `   ↳ Encontrados ${scrolledPlaces.length} lugares en ${cityLabel}`
        );

        // Obtener detalles de cada lugar
        for (const placeUrl of scrolledPlaces) {
          if (allPlaces.length >= maxResults) break;

          // Extraer placeId para evitar duplicados
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
              // Agregar la ciudad de origen
              details.searchCity = cityLabel;
              allPlaces.push(details);

              scraperMetrics.recordPlaceFound({
                phone: details.phone,
                website: details.website,
                socialMediaUrl: details.socialMediaUrl,
                relevanceScore: details.relevanceScore,
              });
            }

            await this.humanSleep(300, 600);
          } catch (error: any) {
            logger.warn(`⚠️ Error en lugar: ${error.message}`);
          }
        }

        citiesSearched++;

        // Delay entre ciudades
        if (i < gridSearch.urls.length - 1 && allPlaces.length < maxResults) {
          await this.humanSleep(2000, 4000);
        }

        // Si ya tenemos suficientes resultados, terminar
        if (allPlaces.length >= maxResults) {
          logger.info(`✅ Objetivo de ${maxResults} leads alcanzado`);
          break;
        }
      } catch (error: any) {
        logger.warn(`⚠️ Error en ciudad ${cityLabel}: ${error.message}`);
      }
    }

    // Guardar en caché
    if (allPlaces.length > 0) {
      await cacheService.set(cacheKey, allPlaces, 86400);
    }

    const totalDuration = Date.now() - startTime;
    logger.info(
      `✅ Búsqueda provincial completada: ${
        allPlaces.length
      } lugares de ${citiesSearched} ciudades en ${(
        totalDuration / 1000
      ).toFixed(1)}s`
    );

    return allPlaces.slice(0, maxResults);
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
    const { maxResults = 100 } = options;

    try {
      // Verificar si la página sigue abierta
      if (page.isClosed()) {
        logger.warn("⚠️ Página cerrada antes de iniciar scrapeSimple");
        return places;
      }

      // Verificar si hay contenido de bloqueo
      const pageContent = await page.content().catch(() => "");
      if (
        pageContent.includes("unusual traffic") ||
        pageContent.includes("captcha")
      ) {
        logger.warn("⚠️ Google bloqueó la solicitud, esperando...");
        await this.sleep(15000);
        await page.reload({ waitUntil: "networkidle2" }).catch(() => {});
        await this.sleep(3000);
      }

      // Esperar un poco más para que cargue la página
      await this.sleep(2000);

      // Intentar esperar el panel de resultados con varios intentos
      let feedFound = false;
      for (let attempt = 0; attempt < 3 && !feedFound; attempt++) {
        try {
          await page.waitForSelector('div[role="feed"]', { timeout: 8000 });
          feedFound = true;
          logger.info("✅ Panel de resultados encontrado");
        } catch {
          logger.warn(
            `⚠️ Intento ${attempt + 1}/3: No se encontró el panel de resultados`
          );
          if (attempt < 2) {
            await this.sleep(3000);
            // Intentar hacer scroll para triggear la carga
            await page.evaluate(() => window.scrollBy(0, 300)).catch(() => {});
          }
        }
      }

      if (!feedFound) {
        logger.warn(
          "⚠️ No se pudo encontrar el panel de resultados después de 3 intentos"
        );
        // Intentar obtener URLs directamente de la página
        const directUrls = await page
          .evaluate(() => {
            const links = document.querySelectorAll('a[href*="/maps/place/"]');
            return Array.from(links)
              .map((l) => l.getAttribute("href"))
              .filter(Boolean) as string[];
          })
          .catch(() => [] as string[]);

        if (directUrls.length > 0) {
          logger.info(
            `📍 Encontrados ${directUrls.length} lugares sin panel de resultados`
          );
          // Continuar con estos URLs
          return this.processPlaceUrls(
            page,
            directUrls.slice(0, maxResults),
            places,
            seenPlaceIds,
            startTime,
            cacheKey,
            options
          );
        }
        return places;
      }

      // Scroll para cargar más resultados
      const scrolledPlaces = await this.scrollAndCollect(page, maxResults);

      if (scrolledPlaces.length === 0) {
        logger.warn("⚠️ No se encontraron lugares durante el scroll");
        return places;
      }

      logger.info(
        `📍 Encontrados ${scrolledPlaces.length} lugares, obteniendo detalles...`
      );

      // Obtener detalles de cada lugar
      for (let i = 0; i < Math.min(scrolledPlaces.length, maxResults); i++) {
        try {
          // Verificar si la página sigue abierta
          if (page.isClosed()) {
            logger.warn("⚠️ Página cerrada durante obtención de detalles");
            break;
          }

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
    } catch (error) {
      // Manejo de error global para evitar crash del servidor
      logger.error(
        `❌ Error crítico en scrapeSimple: ${(error as Error).message}`
      );

      // Guardar lo que tengamos en caché
      if (places.length > 0) {
        await cacheService.set(cacheKey, places, 86400);
      }

      return places; // Devolver lo que hayamos conseguido
    }
  }

  /**
   * Procesar URLs de lugares directamente
   */
  private async processPlaceUrls(
    page: Page,
    urls: string[],
    places: ScrapedPlace[],
    seenPlaceIds: Set<string>,
    startTime: number,
    cacheKey: string,
    options: ScrapeOptions
  ): Promise<ScrapedPlace[]> {
    logger.info(`📍 Procesando ${urls.length} lugares directamente...`);

    for (let i = 0; i < urls.length; i++) {
      try {
        if (page.isClosed()) {
          logger.warn("⚠️ Página cerrada durante procesamiento");
          break;
        }

        const placeUrl = urls[i];
        const details = await this.getPlaceDetails(
          page,
          placeUrl,
          i + 1,
          urls.length
        );

        if (details && !seenPlaceIds.has(details.placeId)) {
          seenPlaceIds.add(details.placeId);
          places.push(details);
          scraperMetrics.recordPlaceFound({
            phone: details.phone,
            website: details.website,
            socialMediaUrl: details.socialMediaUrl,
            relevanceScore: details.relevanceScore,
          });
        }

        await this.humanSleep(300, 800);
      } catch (error) {
        logger.warn(`⚠️ Error en lugar ${i + 1}: ${(error as Error).message}`);
      }
    }

    // Guardar en caché
    if (places.length > 0) {
      await cacheService.set(cacheKey, places, 86400);
      googleMapsCircuitBreaker.recordSuccess();
    }

    const totalDuration = Date.now() - startTime;
    logger.info(
      `✅ Procesamiento directo completado: ${places.length} lugares en ${(
        totalDuration / 1000
      ).toFixed(1)}s`
    );

    return places;
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
   * 🗺️ Mover el mapa a coordenadas específicas y presionar "Buscar en esta área"
   * 🆕 MEJORADO: Combina múltiples estrategias para garantizar la actualización
   */
  private async moveMapAndSearch(
    page: Page,
    targetLat: number,
    targetLng: number,
    keyword: string
  ): Promise<boolean> {
    const MAX_RETRIES = 3;
    let success = false;

    logger.debug(
      `🗺️ Forzando actualización de resultados en (${targetLat.toFixed(
        4
      )}, ${targetLng.toFixed(4)})`
    );

    for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
      try {
        if (attempt > 1) {
          logger.debug(
            `   ↳ Intento ${attempt}/${MAX_RETRIES} de forzar "Buscar en esta área"`
          );
        }

        // ============================================================
        // ESTRATEGIA 1: Arrastrar el mapa (simula comportamiento humano)
        // ============================================================
        const mapContainer = await page.$('div[id="scene"]');
        if (mapContainer) {
          const box = await mapContainer.boundingBox();
          if (box) {
            const startX = box.x + box.width / 2;
            const startY = box.y + box.height / 2;

            // Direcciones de arrastre - varían según el intento
            const directions = [
              { dx: -250, dy: -150, name: "noroeste" },
              { dx: 250, dy: 150, name: "sureste" },
              { dx: -200, dy: 200, name: "suroeste" },
              { dx: 200, dy: -200, name: "noreste" },
            ];

            // Usar una dirección diferente en cada intento
            const dir = directions[(attempt - 1) % directions.length];

            // Simular arrastre humano con movimiento gradual
            await page.mouse.move(startX, startY);
            await this.humanSleep(100, 200);
            await page.mouse.down();
            await this.humanSleep(50, 100);

            // Movimiento gradual (más humano y más largo)
            const steps = 8;
            for (let step = 1; step <= steps; step++) {
              await page.mouse.move(
                startX + (dir.dx * step) / steps,
                startY + (dir.dy * step) / steps
              );
              await this.sleep(25 + Math.random() * 25);
            }

            await page.mouse.up();
            logger.debug(`   ↳ Mapa arrastrado hacia ${dir.name}`);

            await this.humanSleep(600, 1000);
          }
        }

        // ============================================================
        // ESTRATEGIA 2: Buscar y presionar "Buscar en esta área"
        // ============================================================
        success = await this.clickSearchInArea(page);

        if (success) {
          // Esperar a que carguen los nuevos resultados
          await this.humanSleep(2000, 3500);
          await page
            .waitForSelector('div[role="feed"]', { timeout: 15000 })
            .catch(() => {});

          logger.info(`   ✅ "Buscar en esta área" ejecutado exitosamente`);
          return true;
        }

        // ============================================================
        // ESTRATEGIA 3: Zoom in/out para forzar la aparición del botón
        // ============================================================
        if (!success && attempt < MAX_RETRIES) {
          logger.debug(`   ↳ Botón no encontrado, intentando zoom...`);

          // Hacer zoom out y luego in
          await this.zoomMap(page, "out");
          await this.humanSleep(400, 700);
          await this.zoomMap(page, "out");
          await this.humanSleep(600, 1000);
          await this.zoomMap(page, "in");
          await this.humanSleep(400, 700);
          await this.zoomMap(page, "in");
          await this.humanSleep(800, 1200);

          // Intentar presionar el botón de nuevo
          success = await this.clickSearchInArea(page);

          if (success) {
            await this.humanSleep(2000, 3000);
            logger.info(
              `   ✅ "Buscar en esta área" ejecutado después de zoom`
            );
            return true;
          }
        }

        // ============================================================
        // ESTRATEGIA 4: Refrescar búsqueda vía URL (fallback agresivo)
        // ============================================================
        if (!success && attempt === MAX_RETRIES) {
          logger.debug(`   ↳ Forzando recarga de búsqueda vía URL...`);

          // Construir URL con timestamp para forzar recarga
          const timestamp = Date.now();
          const forceReloadUrl = `https://www.google.com/maps/search/${encodeURIComponent(
            keyword
          )}/@${targetLat},${targetLng},15z?entry=tts&g_ep=t${timestamp}`;

          await page.goto(forceReloadUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          await this.humanSleep(2000, 3000);

          // Verificar que hay resultados
          const hasResults = await page.$('div[role="feed"]');
          if (hasResults) {
            logger.info(`   ✅ Búsqueda forzada vía URL exitosa`);
            return true;
          }
        }
      } catch (error) {
        logger.warn(
          `   ⚠️ Error en intento ${attempt}: ${(error as Error).message}`
        );
      }
    }

    // Si llegamos aquí, al menos intentamos todas las estrategias
    // Puede que los resultados ya estén cargados de la navegación inicial
    logger.debug(
      `   ↳ No se pudo presionar "Buscar en esta área", continuando con resultados actuales`
    );
    return false;
  }

  /**
   * 🔍 Buscar y presionar el botón "Buscar en esta área"
   */
  private async clickSearchInArea(page: Page): Promise<boolean> {
    try {
      // Selectores posibles para el botón (puede variar según idioma/versión)
      const buttonSelectors = [
        'button[data-value="Buscar en esta área"]',
        'button[aria-label*="Buscar en esta área"]',
        'button[aria-label*="Search this area"]',
        'button:has-text("Buscar en esta área")',
        'button:has-text("Search this area")',
        // Selector genérico por clase de Google
        "button.hYBOP",
        // El botón suele estar cerca del mapa
        'div[role="main"] button[jsaction*="mouseover"]',
      ];

      for (const selector of buttonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isIntersectingViewport();
            if (isVisible) {
              await this.humanSleep(200, 400);
              await button.click();
              logger.info(`🔍 Botón "Buscar en esta área" presionado`);
              return true;
            }
          }
        } catch {
          // Intentar siguiente selector
        }
      }

      // Fallback: Buscar por texto en el contenido
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || "";
          const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() || "";

          if (
            text.includes("buscar en esta") ||
            text.includes("search this area") ||
            ariaLabel.includes("buscar en esta") ||
            ariaLabel.includes("search this area")
          ) {
            (btn as HTMLButtonElement).click();
            return true;
          }
        }
        return false;
      });

      if (clicked) {
        logger.info(`🔍 Botón "Buscar en esta área" presionado (fallback)`);
        return true;
      }

      logger.debug(`   ↳ Botón "Buscar en esta área" no encontrado`);
      return false;
    } catch (error) {
      logger.debug(`   ↳ Error buscando botón: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 🔍 Hacer zoom in/out en el mapa
   */
  private async zoomMap(page: Page, direction: "in" | "out"): Promise<void> {
    try {
      // Buscar botones de zoom
      const zoomSelector =
        direction === "in"
          ? 'button[aria-label*="Acercar"], button[aria-label*="Zoom in"]'
          : 'button[aria-label*="Alejar"], button[aria-label*="Zoom out"]';

      const zoomButton = await page.$(zoomSelector);
      if (zoomButton) {
        await zoomButton.click();
        logger.debug(
          `   ↳ Zoom ${direction === "in" ? "acercado" : "alejado"}`
        );
      } else {
        // Fallback: usar scroll del mouse sobre el mapa
        const map = await page.$('div[id="scene"]');
        if (map) {
          const box = await map.boundingBox();
          if (box) {
            await page.mouse.move(
              box.x + box.width / 2,
              box.y + box.height / 2
            );
            await page.mouse.wheel({ deltaY: direction === "in" ? -100 : 100 });
          }
        }
      }
    } catch {
      // Ignorar errores de zoom
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

    try {
      while (
        scrollAttempts < CONFIG.MAX_SCROLL_ATTEMPTS &&
        placeUrls.size < maxResults
      ) {
        // Verificar si la página sigue abierta
        if (page.isClosed()) {
          logger.warn("⚠️ Página cerrada durante scroll");
          break;
        }

        // Obtener URLs de lugares visibles
        const urls = await page
          .evaluate(function () {
            var links = document.querySelectorAll('a[href*="/maps/place/"]');
            var result = [];
            for (var i = 0; i < links.length; i++) {
              var href = links[i].getAttribute("href");
              if (href && href.includes("/maps/place/")) {
                result.push(href);
              }
            }
            return result;
          })
          .catch(() => [] as string[]);

        urls.forEach((url) => placeUrls.add(url));

        if (placeUrls.size === lastCount) {
          noNewResultsCount++;
          scrollAttempts++;

          // 🆕 Aumentado a 8 intentos - Google Maps a veces tarda en cargar
          if (noNewResultsCount >= 8) {
            logger.info(
              `📜 Fin de resultados alcanzado después de ${scrollAttempts} scrolls (${placeUrls.size} lugares)`
            );
            break;
          }
        } else {
          noNewResultsCount = 0;
          // 🆕 NO resetear scrollAttempts a 0, solo decrementar para ser más agresivo
          if (scrollAttempts > 0) scrollAttempts--;
          lastCount = placeUrls.size;
        }

        // Scroll en el panel de resultados con comportamiento humano
        await page
          .evaluate(function () {
            var feed = document.querySelector('div[role="feed"]');
            if (feed) {
              // 🆕 Scroll más agresivo para cargar más resultados
              var scrollAmount = 1500 + Math.floor(Math.random() * 500); // ⬆️ 1500 base
              feed.scrollTop = feed.scrollTop + scrollAmount;
            }
          })
          .catch(() => {
            // Ignorar errores de scroll
          });

        // Delay humanizado entre scrolls
        await this.humanSleep(800, 1500);
        logger.debug(
          `📜 Scroll ${scrollAttempts + 1}: ${
            placeUrls.size
          } lugares encontrados`
        );
      }
    } catch (error) {
      logger.warn(`⚠️ Error durante scroll: ${(error as Error).message}`);
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

        // Website - múltiples selectores para mayor compatibilidad
        var website = "";
        // 1. Selector principal de autoridad
        var websiteButton = document.querySelector(
          'a[data-item-id="authority"]'
        );
        if (websiteButton) {
          var hrefAttr = websiteButton.getAttribute("href");
          if (hrefAttr) website = hrefAttr;
        }
        // 2. Fallback: buscar en botones con ícono de website
        if (!website) {
          var allLinks = document.querySelectorAll('a[href^="http"]');
          for (var i = 0; i < allLinks.length; i++) {
            var link = allLinks[i] as HTMLAnchorElement;
            var href = link.href;
            // Ignorar links de Google, redes sociales, etc
            if (
              href &&
              !href.includes("google.com") &&
              !href.includes("facebook.com") &&
              !href.includes("instagram.com") &&
              !href.includes("twitter.com") &&
              !href.includes("youtube.com") &&
              !href.includes("linkedin.com") &&
              link.closest('div[role="region"]')
            ) {
              website = href;
              break;
            }
          }
        }
        // 3. Fallback: buscar texto que parezca URL en la página
        if (!website) {
          var bodyText = document.body.innerText || "";
          var urlMatch = bodyText.match(
            /(?:www\.|https?:\/\/)[a-zA-Z0-9][-a-zA-Z0-9]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i
          );
          if (urlMatch) {
            website = urlMatch[0].startsWith("http")
              ? urlMatch[0]
              : "https://" + urlMatch[0];
          }
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
      // Verificar si es un directorio (Argenprop, ZonaProp, etc.)
      const isDirectory = this.isDirectoryUrl(data.website || "");
      // Solo es website REAL si no es red social NI directorio
      const hasRealWebsite = this.isRealBusinessWebsite(data.website || "");

      // Extraer URLs específicas de redes sociales
      const socialUrls = this.extractSocialUrls(data.website || "");

      // Calcular relevancia
      const relevanceScore = this.calculateRelevanceScore(
        data.name,
        data.category || "",
        this.currentKeyword
      );

      // Log mejorado con más info
      const webStatus = hasRealWebsite
        ? "🌐"
        : isSocialMedia
        ? "📱"
        : isDirectory
        ? "📋"
        : "❌";
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
