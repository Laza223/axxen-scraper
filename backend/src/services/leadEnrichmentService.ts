/**
 * 🔍 LEAD ENRICHMENT SERVICE
 *
 * Servicio agresivo de enriquecimiento de leads que:
 * 1. Busca sitio web en Google si no está en Maps
 * 2. Extrae emails de la web, Instagram y Facebook
 * 3. Obtiene teléfonos de redes sociales
 * 4. Combina todas las fuentes para maximizar datos
 */

import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer, { Browser } from "puppeteer";
import antiDetection from "./antiDetection";
import logger from "./logger";

// ============================================================================
// INTERFACES
// ============================================================================

export interface LeadContactData {
  // Emails encontrados (ordenados por prioridad)
  emails: string[];
  primaryEmail: string | null;
  emailSource: "website" | "instagram" | "facebook" | "google" | null;

  // Teléfonos
  phones: string[];
  primaryPhone: string | null;
  whatsappNumber: string | null;
  phoneSource: "website" | "instagram" | "facebook" | "google_maps" | null;

  // Website
  websiteUrl: string | null;
  websiteSource:
    | "google_maps"
    | "google_search"
    | "instagram_bio"
    | "facebook"
    | null;
  hasRealWebsite: boolean;

  // Redes sociales
  instagramUrl: string | null;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  instagramBio: string | null;

  facebookUrl: string | null;
  facebookPageName: string | null;

  // Metadata
  enrichmentSources: string[];
  enrichmentScore: number; // 0-100, qué tan completo está el lead
  lastEnriched: Date;
}

export interface EnrichmentOptions {
  searchGoogleForWebsite?: boolean; // Buscar web en Google si no tiene
  scrapeInstagram?: boolean; // Entrar a Instagram a buscar datos
  scrapeFacebook?: boolean; // Entrar a Facebook a buscar datos
  scrapeWebsite?: boolean; // Buscar email en el sitio web
  maxTimeMs?: number; // Tiempo máximo de enriquecimiento
}

// ============================================================================
// REGEX PATTERNS
// ============================================================================

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

const PHONE_REGEX_AR =
  /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d{1,3})[\s-]?\d{4}[\s-]?\d{4}/g;
const PHONE_REGEX_INTL =
  /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

// Dominios de email a ignorar
const IGNORED_EMAIL_DOMAINS = [
  "example.com",
  "test.com",
  "email.com",
  "domain.com",
  "sentry.io",
  "wixpress.com",
  "wordpress.com",
  "squarespace.com",
];

// Emails específicos a ignorar
const IGNORED_EMAILS = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "mailer-daemon@",
  "postmaster@",
  "webmaster@",
  "admin@localhost",
];

// Dominios de redes sociales (no son websites reales)
const SOCIAL_MEDIA_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
  "wa.me",
  "whatsapp.com",
  "t.me",
  "telegram.org",
];

// Dominios de directorios (NO son websites del negocio - perfiles en plataformas)
const DIRECTORY_DOMAINS = [
  // Directorios internacionales
  "yelp.com",
  "tripadvisor.com",
  "foursquare.com",
  "trustpilot.com",
  "yellowpages.com",
  "whitepages.com",
  "bbb.org",
  "manta.com",
  "hotfrog.com",

  // Google y redes sociales (ya cubiertos arriba pero por si acaso)
  "google.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",

  // Directorios Argentina
  "paginasamarillas.com",
  "paginasamarillas.com.ar",
  "guiaoleo.com.ar",
  "zonajobs.com",
  "bumeran.com.ar",
  "computrabajo.com.ar",

  // Inmobiliarias y clasificados Argentina
  "argenprop.com",
  "zonaprop.com",
  "properati.com.ar",
  "inmuebles.clarin.com",
  "remax.com.ar",
  "century21.com.ar",
  "inmobusqueda.com.ar",
  "cabaprop.com.ar",
  "mudafy.com.ar",
  "mercadolibre.com.ar",
  "mercadolibre.com",
  "olx.com.ar",
  "olx.com",
  "alamaula.com",
  "segundamano.com",

  // Gastronómicos Argentina
  "restorando.com.ar",
  "pedidosya.com",
  "rappi.com.ar",
  "glovo.com",

  // Salud Argentina
  "doctoralia.com.ar",
  "doctoraliar.com",

  // Servicios profesionales
  "tuabogado.com.ar",
  "abogados.com.ar",

  // Autos Argentina
  "autocosmos.com.ar",
  "demotores.com.ar",
  "kavak.com",
  "autofoco.com",

  // Educación
  "buscadordeescuelas.com.ar",

  // Directorios genéricos
  "cylex.com.ar",
  "infobel.com",
  "tupalo.com",
  "locanto.com.ar",
  "vivanuncios.com",
  "anunico.com.ar",
  "clasificados.lavoz.com.ar",

  // Plataformas de creación de webs (no son web propias)
  "wix.com",
  "weebly.com",
  "sites.google.com",
  "wordpress.com", // .com es gratuito, .org es propio
  "blogspot.com",
  "tumblr.com",
  "carrd.co",
  "linktree.com",
  "linktr.ee",
  "bio.link",
  "beacons.ai",
];

// ============================================================================
// LEAD ENRICHMENT SERVICE
// ============================================================================

class LeadEnrichmentService {
  private browser: Browser | null = null;

  private axiosInstance = axios.create({
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    },
  });

  // ==========================================================================
  // BROWSER MANAGEMENT
  // ==========================================================================

  private async initBrowser(): Promise<void> {
    if (this.browser) return;

    const resolution = antiDetection.getRandomResolution();

    this.browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--window-size=${resolution.width},${resolution.height}`,
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: resolution,
    });

    logger.info("🔍 Lead Enrichment Service: Navegador iniciado");
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info("🔍 Lead Enrichment Service: Navegador cerrado");
    }
  }

  // ==========================================================================
  // WEBSITE VERIFICATION
  // ==========================================================================

  /**
   * Verificar si un website realmente existe y responde
   * CRÍTICO: No podemos equivocarnos en si tiene web o no
   */
  private async verifyWebsiteExists(url: string): Promise<{
    exists: boolean;
    finalUrl: string | null;
    statusCode: number | null;
  }> {
    if (!url) return { exists: false, finalUrl: null, statusCode: null };

    try {
      // Normalizar URL
      let normalizedUrl = url;
      if (!normalizedUrl.startsWith("http")) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Verificar que no sea red social o directorio
      if (this.isSocialMediaUrl(normalizedUrl)) {
        return { exists: false, finalUrl: null, statusCode: null };
      }

      // Hacer request HEAD primero (más rápido)
      try {
        const headResponse = await this.axiosInstance.head(normalizedUrl, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: (status) => status < 500, // Aceptar cualquier respuesta no-error
        });

        if (headResponse.status >= 200 && headResponse.status < 400) {
          const finalUrl =
            headResponse.request?.res?.responseUrl || normalizedUrl;
          logger.debug(
            `✅ Website verificado (HEAD): ${normalizedUrl} -> ${headResponse.status}`
          );
          return { exists: true, finalUrl, statusCode: headResponse.status };
        }
      } catch {
        // HEAD falló, intentar GET
      }

      // Fallback a GET
      const getResponse = await this.axiosInstance.get(normalizedUrl, {
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });

      if (getResponse.status >= 200 && getResponse.status < 400) {
        const finalUrl = getResponse.request?.res?.responseUrl || normalizedUrl;

        // Verificar que no sea una página de parking/error
        const html = getResponse.data?.toString() || "";
        const isParked = this.isParkedDomain(html);

        if (isParked) {
          logger.debug(`⚠️ Website parked/no real: ${normalizedUrl}`);
          return { exists: false, finalUrl: null, statusCode: null };
        }

        logger.debug(
          `✅ Website verificado (GET): ${normalizedUrl} -> ${getResponse.status}`
        );
        return { exists: true, finalUrl, statusCode: getResponse.status };
      }

      return { exists: false, finalUrl: null, statusCode: getResponse.status };
    } catch (error) {
      logger.debug(
        `❌ Website no existe: ${url} - ${(error as Error).message}`
      );
      return { exists: false, finalUrl: null, statusCode: null };
    }
  }

  /**
   * Detectar si un dominio es una página de parking (sin contenido real)
   */
  private isParkedDomain(html: string): boolean {
    const lowerHtml = html.toLowerCase();
    const parkingIndicators = [
      "domain is for sale",
      "this domain is parked",
      "buy this domain",
      "domain parking",
      "este dominio está en venta",
      "dominio en venta",
      "página en construcción",
      "coming soon",
      "under construction",
      "sitio en mantenimiento",
    ];

    return parkingIndicators.some((indicator) => lowerHtml.includes(indicator));
  }

  // ==========================================================================
  // MAIN ENRICHMENT METHOD
  // ==========================================================================

  /**
   * Enriquecer un lead con datos de contacto de múltiples fuentes
   * OPTIMIZADO: Ejecuta scrapers en paralelo para mayor velocidad
   */
  async enrichLead(
    businessName: string,
    location: string,
    existingData: {
      website?: string;
      phone?: string;
      instagramUrl?: string;
      facebookUrl?: string;
    } = {},
    options: EnrichmentOptions = {}
  ): Promise<LeadContactData> {
    const startTime = Date.now();
    const maxTime = options.maxTimeMs || 12000; // ⚡ Reducido a 12 segundos

    // Configuración por defecto
    const config: Required<EnrichmentOptions> = {
      searchGoogleForWebsite: options.searchGoogleForWebsite ?? true,
      scrapeInstagram: options.scrapeInstagram ?? true,
      scrapeFacebook: options.scrapeFacebook ?? true,
      scrapeWebsite: options.scrapeWebsite ?? true,
      maxTimeMs: maxTime,
    };

    logger.info(`🔍 Enriqueciendo lead: ${businessName} (${location})`);

    // Resultado inicial
    const result: LeadContactData = {
      emails: [],
      primaryEmail: null,
      emailSource: null,
      phones: existingData.phone ? [existingData.phone] : [],
      primaryPhone: existingData.phone || null,
      whatsappNumber: null,
      phoneSource: existingData.phone ? "google_maps" : null,
      websiteUrl: null,
      websiteSource: null,
      hasRealWebsite: false,
      instagramUrl: existingData.instagramUrl || null,
      instagramHandle: null,
      instagramFollowers: null,
      instagramBio: null,
      facebookUrl: existingData.facebookUrl || null,
      facebookPageName: null,
      enrichmentSources: [],
      enrichmentScore: 0,
      lastEnriched: new Date(),
    };

    try {
      // PASO 1: 🔍 VERIFICAR SI EL WEBSITE DE MAPS REALMENTE EXISTE
      // CRÍTICO: No confiar ciegamente en Google Maps
      let websiteVerified = false;

      if (
        existingData.website &&
        !this.isSocialMediaUrl(existingData.website)
      ) {
        logger.debug(`🔍 Verificando website de Maps: ${existingData.website}`);
        const verification = await this.verifyWebsiteExists(
          existingData.website
        );

        if (verification.exists) {
          result.websiteUrl = verification.finalUrl || existingData.website;
          result.websiteSource = "google_maps";
          result.hasRealWebsite = true;
          result.enrichmentSources.push("google_maps_website");
          websiteVerified = true;
          logger.info(`✅ Website verificado: ${result.websiteUrl}`);
        } else {
          logger.warn(
            `⚠️ Website de Maps NO existe/responde: ${existingData.website}`
          );
        }
      }

      // PASO 2: ⚡ EJECUTAR TODO EN PARALELO para mayor velocidad
      const parallelTasks: Promise<void>[] = [];

      // Task 1: Buscar website en Google (SIEMPRE si no se verificó uno)
      if (config.searchGoogleForWebsite && !websiteVerified) {
        parallelTasks.push(
          this.searchWebsiteInGoogle(businessName, location)
            .then(async (googleWebsite) => {
              if (googleWebsite && !result.websiteUrl) {
                // Verificar que el website encontrado realmente existe
                const verification = await this.verifyWebsiteExists(
                  googleWebsite
                );
                if (verification.exists) {
                  result.websiteUrl = verification.finalUrl || googleWebsite;
                  result.websiteSource = "google_search";
                  result.hasRealWebsite = true;
                  result.enrichmentSources.push("google_search");
                  logger.info(
                    `✅ Website encontrado en Google: ${result.websiteUrl}`
                  );
                }
              }
            })
            .catch(() => {})
        );
      }

      // Task 2: Scrape Instagram EXHAUSTIVO (buscar email en bio y contacto)
      if (config.scrapeInstagram && result.instagramUrl) {
        parallelTasks.push(
          this.scrapeInstagramExhaustive(result.instagramUrl, businessName)
            .then((igData) => {
              if (igData) {
                result.instagramHandle = igData.handle;
                result.instagramFollowers = igData.followers;
                result.instagramBio = igData.bio;
                if (igData.emails.length > 0) {
                  result.emails.push(...igData.emails);
                  if (!result.primaryEmail) {
                    result.primaryEmail = igData.emails[0];
                    result.emailSource = "instagram";
                  }
                }
                if (igData.phones.length > 0) {
                  result.phones.push(...igData.phones);
                }
                if (igData.whatsapp) {
                  result.whatsappNumber = igData.whatsapp;
                }
                if (igData.websiteFromBio && !result.websiteUrl) {
                  result.websiteUrl = igData.websiteFromBio;
                  result.websiteSource = "instagram_bio";
                  result.hasRealWebsite = true;
                }
                result.enrichmentSources.push("instagram");
              }
            })
            .catch(() => {})
        );
      }

      // Task 3: Scrape Facebook (rápido con axios)
      if (config.scrapeFacebook && result.facebookUrl) {
        parallelTasks.push(
          this.scrapeFacebookFast(result.facebookUrl)
            .then((fbData) => {
              if (fbData) {
                result.facebookPageName = fbData.pageName;
                if (fbData.emails.length > 0) {
                  result.emails.push(...fbData.emails);
                  if (!result.primaryEmail) {
                    result.primaryEmail = fbData.emails[0];
                    result.emailSource = "facebook";
                  }
                }
                if (fbData.phones.length > 0) {
                  result.phones.push(...fbData.phones);
                }
                if (fbData.website && !result.websiteUrl) {
                  result.websiteUrl = fbData.website;
                  result.websiteSource = "facebook";
                  result.hasRealWebsite = true;
                }
                result.enrichmentSources.push("facebook");
              }
            })
            .catch(() => {})
        );
      }

      // Esperar tareas iniciales (máximo 6 segundos)
      await Promise.race([Promise.all(parallelTasks), this.sleep(6000)]);

      // PASO 3: Scrape del website (ahora que tenemos la URL)
      if (config.scrapeWebsite && result.websiteUrl) {
        const webData = await Promise.race([
          this.scrapeWebsite(result.websiteUrl),
          this.sleep(5000).then(() => null),
        ]);

        if (webData) {
          // Emails del website tienen máxima prioridad
          if (webData.emails.length > 0) {
            const websiteEmails = webData.emails.filter(
              (e) => !result.emails.includes(e)
            );
            result.emails = [...websiteEmails, ...result.emails];
            result.primaryEmail = webData.emails[0];
            result.emailSource = "website";
          }

          if (webData.phones.length > 0) {
            const websitePhones = webData.phones.filter(
              (p) => !result.phones.includes(p)
            );
            result.phones = [...websitePhones, ...result.phones];
            if (!result.primaryPhone) {
              result.primaryPhone = webData.phones[0];
              result.phoneSource = "website";
            }
          }

          if (webData.instagramUrl && !result.instagramUrl) {
            result.instagramUrl = webData.instagramUrl;
          }
          if (webData.facebookUrl && !result.facebookUrl) {
            result.facebookUrl = webData.facebookUrl;
          }

          result.enrichmentSources.push("website");
        }
      }

      // PASO 4: Eliminar duplicados
      result.emails = [...new Set(result.emails)];
      result.phones = [...new Set(result.phones)];

      // PASO 5: Calcular score de enriquecimiento
      result.enrichmentScore = this.calculateEnrichmentScore(result);

      const duration = Date.now() - startTime;
      logger.info(
        `✅ Enriquecido: ${businessName} | ` +
          `📧 ${result.emails.length} | 📞 ${result.phones.length} | ` +
          `🌐 ${result.hasRealWebsite ? "Sí" : "No"} | Score: ${
            result.enrichmentScore
          } | ` +
          `⏱️ ${(duration / 1000).toFixed(1)}s`
      );

      return result;
    } catch (error) {
      logger.error(
        `❌ Error enriqueciendo ${businessName}: ${(error as Error).message}`
      );
      result.enrichmentScore = this.calculateEnrichmentScore(result);
      return result;
    }
  }

  // ==========================================================================
  // ⚡ FAST SCRAPING METHODS (usando axios en lugar de Puppeteer)
  // ==========================================================================

  /**
   * Scraping rápido de Instagram usando axios (no Puppeteer)
   */
  private async scrapeInstagramFast(instagramUrl: string): Promise<{
    handle: string | null;
    followers: number | null;
    bio: string | null;
    emails: string[];
    phones: string[];
    whatsapp: string | null;
    websiteFromBio: string | null;
  } | null> {
    try {
      let url = instagramUrl;
      if (!url.startsWith("http")) {
        url = `https://www.instagram.com/${url.replace("@", "")}`;
      }

      const response = await this.axiosInstance.get(url, {
        timeout: 5000,
        headers: {
          "User-Agent": antiDetection.getRandomUserAgent(),
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extraer meta tags
      const ogTitle = $('meta[property="og:title"]').attr("content") || "";
      const ogDescription =
        $('meta[property="og:description"]').attr("content") || "";

      // Handle
      const handleMatch = ogTitle.match(/@([a-zA-Z0-9_.]+)/);
      const handle = handleMatch ? handleMatch[1] : null;

      // Bio
      const bio = ogDescription || null;

      // Followers (del texto)
      let followers: number | null = null;
      const followersMatch = ogDescription.match(
        /(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:seguidores|followers)/i
      );
      if (followersMatch) {
        let num = followersMatch[1].replace(/,/g, "").replace(/\./g, "");
        if (num.toLowerCase().includes("k")) {
          followers = parseInt(num) * 1000;
        } else if (num.toLowerCase().includes("m")) {
          followers = parseInt(num) * 1000000;
        } else {
          followers = parseInt(num) || null;
        }
      }

      // Extraer emails y teléfonos del bio
      const emails: string[] = [];
      const phones: string[] = [];
      let whatsapp: string | null = null;
      let websiteFromBio: string | null = null;

      if (bio) {
        const emailMatches = bio.match(EMAIL_REGEX);
        if (emailMatches) {
          emails.push(...emailMatches.filter((e) => this.isValidEmail(e)));
        }

        const phoneMatches = bio.match(PHONE_REGEX_AR);
        if (phoneMatches) {
          phones.push(...phoneMatches);
        }

        const waMatch = bio.match(/(?:wa\.me\/|whatsapp[:\s]*)([\d+]+)/i);
        if (waMatch) {
          whatsapp = waMatch[1];
        }

        // Website en bio
        const webMatch = html.match(
          /linktr\.ee\/[a-zA-Z0-9_]+|(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g
        );
        if (webMatch) {
          for (const w of webMatch) {
            if (!this.isSocialMediaUrl(w) && !w.includes("instagram")) {
              websiteFromBio = w.startsWith("http") ? w : `https://${w}`;
              break;
            }
          }
        }
      }

      return {
        handle,
        followers,
        bio,
        emails,
        phones,
        whatsapp,
        websiteFromBio,
      };
    } catch (error) {
      // Fallback a Puppeteer si axios falla
      return this.scrapeInstagram(instagramUrl);
    }
  }

  /**
   * Scraping EXHAUSTIVO de Instagram usando Puppeteer
   * Busca email en: bio, botón de contacto, posts recientes, highlights
   */
  private async scrapeInstagramExhaustive(
    instagramUrl: string,
    businessName: string
  ): Promise<{
    handle: string | null;
    followers: number | null;
    bio: string | null;
    emails: string[];
    phones: string[];
    whatsapp: string | null;
    websiteFromBio: string | null;
  } | null> {
    // Primero intentar método rápido
    const fastResult = await this.scrapeInstagramFast(instagramUrl);

    // Si encontramos email, retornar
    if (fastResult && fastResult.emails.length > 0) {
      logger.debug(
        `📸 Instagram (fast): email encontrado para ${businessName}`
      );
      return fastResult;
    }

    // Si no hay email, intentar con Puppeteer para ver el botón de contacto
    try {
      await this.initBrowser();
      if (!this.browser) return fastResult;

      const page = await this.browser.newPage();

      try {
        await page.setUserAgent(antiDetection.getRandomUserAgent());

        let url = instagramUrl;
        if (!url.startsWith("http")) {
          url = `https://www.instagram.com/${url.replace("@", "")}`;
        }

        logger.debug(`📸 Instagram (exhaustive): buscando email en ${url}`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
        await this.sleep(2000 + Math.random() * 1000);

        // Extraer todo el contenido de la página
        const pageData = await page.evaluate(() => {
          const result = {
            handle: null as string | null,
            followers: null as number | null,
            bio: "",
            emails: [] as string[],
            phones: [] as string[],
            website: null as string | null,
          };

          // Bio completa
          const bioElement = document.querySelector(
            'div[class*="biography"], span[class*="biography"], meta[name="description"]'
          );
          if (bioElement) {
            result.bio =
              bioElement.textContent ||
              (bioElement as HTMLMetaElement).content ||
              "";
          }

          // Buscar en todo el texto de la página
          const pageText = document.body.innerText || "";
          result.bio = result.bio || pageText;

          // Buscar emails
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const emailMatches = pageText.match(emailRegex);
          if (emailMatches) {
            result.emails = [...new Set(emailMatches)];
          }

          // Buscar teléfonos
          const phoneRegex =
            /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d{1,3})[\s-]?\d{4}[\s-]?\d{4}/g;
          const phoneMatches = pageText.match(phoneRegex);
          if (phoneMatches) {
            result.phones = [...new Set(phoneMatches)];
          }

          // Buscar links externos (website)
          const links = document.querySelectorAll("a[href]");
          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (
              href &&
              !href.includes("instagram.com") &&
              !href.includes("facebook.com") &&
              !href.includes("l.instagram.com") &&
              href.startsWith("http")
            ) {
              // Decodificar URL de redirect de Instagram
              const urlMatch = href.match(/[?&]u=([^&]+)/);
              if (urlMatch) {
                try {
                  result.website = decodeURIComponent(urlMatch[1]);
                } catch {}
              } else if (!result.website) {
                result.website = href;
              }
            }
          });

          // Buscar seguidores
          const statsText = pageText.match(
            /(\d+(?:[.,]\d+)?[KMkm]?)\s*(?:seguidores|followers)/i
          );
          if (statsText) {
            let num = statsText[1].replace(/,/g, "").replace(/\./g, "");
            if (num.toLowerCase().includes("k")) {
              result.followers = parseInt(num) * 1000;
            } else if (num.toLowerCase().includes("m")) {
              result.followers = parseInt(num) * 1000000;
            } else {
              result.followers = parseInt(num) || null;
            }
          }

          return result;
        });

        await page.close();

        // Filtrar emails válidos
        const validEmails = pageData.emails.filter((e: string) =>
          this.isValidEmail(e)
        );

        const result = {
          handle: pageData.handle || fastResult?.handle || null,
          followers: pageData.followers || fastResult?.followers || null,
          bio: pageData.bio || fastResult?.bio || null,
          emails:
            validEmails.length > 0 ? validEmails : fastResult?.emails || [],
          phones:
            pageData.phones.length > 0
              ? pageData.phones
              : fastResult?.phones || [],
          whatsapp: fastResult?.whatsapp || null,
          websiteFromBio:
            pageData.website || fastResult?.websiteFromBio || null,
        };

        if (validEmails.length > 0) {
          logger.info(
            `📸 Instagram (exhaustive): email encontrado para ${businessName}: ${validEmails[0]}`
          );
        }

        return result;
      } catch (error) {
        try {
          await page.close();
        } catch {}
        return fastResult;
      }
    } catch (error) {
      logger.debug(
        `⚠️ Instagram exhaustive error: ${(error as Error).message}`
      );
      return fastResult;
    }
  }

  /**
   * Scraping de Facebook usando Puppeteer (necesario porque FB requiere JS)
   * Busca en: /about, /about_contact_and_basic_info, página principal
   */
  private async scrapeFacebookFast(facebookUrl: string): Promise<{
    pageName: string | null;
    emails: string[];
    phones: string[];
    website: string | null;
  } | null> {
    try {
      await this.initBrowser();
      if (!this.browser) return null;

      const page = await this.browser.newPage();

      try {
        await page.setUserAgent(antiDetection.getRandomUserAgent());

        // Normalizar URL base
        const baseUrl = facebookUrl
          .replace(/\/$/, "")
          .split("/about")[0]
          .split("/contact")[0];

        const pageName: string | null = null;
        const allEmails = new Set<string>();
        const allPhones = new Set<string>();
        let website: string | null = null;

        // Páginas a revisar en orden de prioridad
        const pagesToCheck = [
          `${baseUrl}/about_contact_and_basic_info`, // Info de contacto
          `${baseUrl}/about`, // Acerca de
          baseUrl, // Página principal
        ];

        for (const url of pagesToCheck) {
          try {
            logger.debug(`📘 Facebook: revisando ${url}`);

            await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
            await this.sleep(1500 + Math.random() * 1000);

            // Extraer todo el contenido visible
            const pageData = await page.evaluate(() => {
              const result = {
                text: "",
                emails: [] as string[],
                phones: [] as string[],
                website: null as string | null,
              };

              // Obtener todo el texto visible
              result.text = document.body.innerText || "";

              // Buscar emails con regex
              const emailRegex =
                /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
              const emailMatches = result.text.match(emailRegex);
              if (emailMatches) {
                result.emails = [...new Set(emailMatches)];
              }

              // Buscar teléfonos argentinos y otros
              const phoneRegex =
                /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d{1,3})[\s-]?\d{4}[\s-]?\d{4}/g;
              const phoneMatches = result.text.match(phoneRegex);
              if (phoneMatches) {
                result.phones = [...new Set(phoneMatches)];
              }

              // Buscar links de website en la página
              const links = document.querySelectorAll("a[href]");
              links.forEach((link) => {
                const href = (link as HTMLAnchorElement).href;
                if (
                  href &&
                  !href.includes("facebook.com") &&
                  !href.includes("instagram.com") &&
                  !href.includes("twitter.com") &&
                  !href.includes("youtube.com") &&
                  href.startsWith("http") &&
                  !href.includes("l.facebook.com/l.php")
                ) {
                  // Extraer URL real si está en un redirect de FB
                  const urlMatch = href.match(/[?&]u=([^&]+)/);
                  if (urlMatch) {
                    try {
                      result.website = decodeURIComponent(urlMatch[1]);
                    } catch {}
                  } else if (!result.website) {
                    result.website = href;
                  }
                }
              });

              // También buscar en el texto patrones de URL
              const urlMatch = result.text.match(
                /(?:Sitio web|Website|Web)[:\s]*(https?:\/\/[^\s]+|www\.[^\s]+)/i
              );
              if (urlMatch && !result.website) {
                result.website = urlMatch[1].startsWith("http")
                  ? urlMatch[1]
                  : `https://${urlMatch[1]}`;
              }

              return result;
            });

            // Agregar resultados
            pageData.emails.forEach((e) => {
              if (this.isValidEmail(e)) allEmails.add(e.toLowerCase());
            });
            pageData.phones.forEach((p) => allPhones.add(p));
            if (pageData.website && !website) {
              website = pageData.website;
            }

            // Si encontramos email, podemos parar
            if (allEmails.size > 0) {
              logger.debug(`📧 Facebook: encontrado email en ${url}`);
              break;
            }
          } catch (navError) {
            logger.debug(
              `⚠️ Facebook: error en ${url}: ${(navError as Error).message}`
            );
          }
        }

        await page.close();

        return {
          pageName,
          emails: [...allEmails].slice(0, 5),
          phones: [...allPhones].slice(0, 5),
          website,
        };
      } catch (error) {
        try {
          await page.close();
        } catch {}
        throw error;
      }
    } catch (error) {
      logger.warn(`⚠️ Error scraping Facebook: ${(error as Error).message}`);
      return null;
    }
  }

  // ==========================================================================
  // GOOGLE SEARCH FOR WEBSITE
  // ==========================================================================

  /**
   * Buscar el sitio web del negocio en Google si no está en Maps
   */
  private async searchWebsiteInGoogle(
    businessName: string,
    location: string
  ): Promise<string | null> {
    try {
      await this.initBrowser();
      if (!this.browser) return null;

      const page = await this.browser.newPage();

      try {
        await page.setUserAgent(antiDetection.getRandomUserAgent());

        // Buscar: "Nombre Negocio Ciudad sitio web oficial"
        const searchQuery = encodeURIComponent(
          `${businessName} ${location} sitio web oficial`
        );
        const searchUrl = `https://www.google.com/search?q=${searchQuery}&hl=es`;

        logger.debug(`🔍 Buscando website en Google: ${businessName}`);

        await page.goto(searchUrl, {
          waitUntil: "networkidle2",
          timeout: 15000,
        });
        await this.sleep(1000 + Math.random() * 1000);

        // Extraer resultados de búsqueda
        const results = await page.evaluate(() => {
          const links: string[] = [];

          // Buscar links en resultados orgánicos
          const resultDivs = document.querySelectorAll('div.g a[href^="http"]');
          resultDivs.forEach((a) => {
            const href = a.getAttribute("href");
            if (href) links.push(href);
          });

          // También buscar en el panel lateral (si existe)
          const sidePanel = document.querySelector("a[data-url]");
          if (sidePanel) {
            const dataUrl = sidePanel.getAttribute("data-url");
            if (dataUrl) links.unshift(dataUrl);
          }

          return links.slice(0, 10); // Primeros 10 resultados
        });

        // Filtrar resultados
        for (const url of results) {
          // Ignorar redes sociales y directorios
          if (this.isValidBusinessWebsite(url, businessName)) {
            await page.close();
            return url;
          }
        }

        await page.close();
        return null;
      } catch (error) {
        try {
          await page.close();
        } catch {}
        throw error;
      }
    } catch (error) {
      logger.warn(
        `⚠️ Error buscando website en Google: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * Verificar si una URL es un website válido del negocio
   */
  private isValidBusinessWebsite(url: string, businessName: string): boolean {
    const lowerUrl = url.toLowerCase();

    // Ignorar redes sociales
    for (const domain of SOCIAL_MEDIA_DOMAINS) {
      if (lowerUrl.includes(domain)) return false;
    }

    // Ignorar directorios
    for (const domain of DIRECTORY_DOMAINS) {
      if (lowerUrl.includes(domain)) return false;
    }

    // Bonus si el dominio contiene parte del nombre del negocio
    const nameParts = businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter((p) => p.length > 3);

    for (const part of nameParts) {
      if (lowerUrl.includes(part)) {
        return true;
      }
    }

    // Aceptar si no es una red social ni directorio
    return true;
  }

  // ==========================================================================
  // INSTAGRAM SCRAPING
  // ==========================================================================

  /**
   * Extraer datos de un perfil de Instagram
   */
  private async scrapeInstagram(instagramUrl: string): Promise<{
    handle: string | null;
    followers: number | null;
    bio: string | null;
    emails: string[];
    phones: string[];
    whatsapp: string | null;
    websiteFromBio: string | null;
  } | null> {
    try {
      await this.initBrowser();
      if (!this.browser) return null;

      const page = await this.browser.newPage();

      try {
        await page.setUserAgent(antiDetection.getRandomUserAgent());

        // Normalizar URL de Instagram
        let url = instagramUrl;
        if (!url.startsWith("http")) {
          url = `https://www.instagram.com/${url.replace("@", "")}`;
        }

        logger.debug(`📸 Scraping Instagram: ${url}`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
        await this.sleep(2000 + Math.random() * 1000);

        // Verificar si es una página válida (no login wall)
        const isLoginWall = await page.evaluate(() => {
          return document.querySelector('input[name="username"]') !== null;
        });

        if (isLoginWall) {
          logger.warn(
            "⚠️ Instagram requiere login, usando datos públicos limitados"
          );
        }

        // Extraer datos del perfil
        const data = await page.evaluate(() => {
          const result = {
            handle: null as string | null,
            followers: null as number | null,
            bio: null as string | null,
            websiteFromBio: null as string | null,
          };

          // Handle (@usuario)
          const titleMeta = document.querySelector('meta[property="og:title"]');
          if (titleMeta) {
            const content = titleMeta.getAttribute("content") || "";
            const match = content.match(/@([a-zA-Z0-9_.]+)/);
            if (match) result.handle = match[1];
          }

          // Bio y descripción
          const descMeta = document.querySelector(
            'meta[property="og:description"]'
          );
          if (descMeta) {
            result.bio = descMeta.getAttribute("content") || null;
          }

          // Followers (desde el texto de la página)
          const pageText = document.body.innerText;
          const followersMatch = pageText.match(
            /(\d+(?:[.,]\d+)?)\s*(?:seguidores|followers)/i
          );
          if (followersMatch) {
            let num = followersMatch[1].replace(",", "").replace(".", "");
            result.followers = parseInt(num) || null;
          }

          // Link en bio (si está visible)
          const bioLink = document.querySelector('a[href*="l.instagram.com"]');
          if (bioLink) {
            const href = bioLink.getAttribute("href");
            if (href) {
              // Decodificar la URL de Instagram
              const urlMatch = href.match(/u=([^&]+)/);
              if (urlMatch) {
                result.websiteFromBio = decodeURIComponent(urlMatch[1]);
              }
            }
          }

          return result;
        });

        // Extraer emails y teléfonos del bio
        const emails: string[] = [];
        const phones: string[] = [];
        let whatsapp: string | null = null;

        if (data.bio) {
          // Emails en bio
          const emailMatches = data.bio.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
          );
          if (emailMatches) {
            emails.push(...emailMatches.filter((e) => this.isValidEmail(e)));
          }

          // Teléfonos en bio
          const phoneMatches = data.bio.match(
            /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d{1,3})[\s-]?\d{4}[\s-]?\d{4}/g
          );
          if (phoneMatches) {
            phones.push(...phoneMatches);
          }

          // WhatsApp
          const waMatch = data.bio.match(
            /(?:wa\.me\/|whatsapp[:\s]*)([\d+]+)/i
          );
          if (waMatch) {
            whatsapp = waMatch[1];
          }
        }

        await page.close();

        return {
          handle: data.handle,
          followers: data.followers,
          bio: data.bio,
          emails,
          phones,
          whatsapp,
          websiteFromBio: data.websiteFromBio,
        };
      } catch (error) {
        try {
          await page.close();
        } catch {}
        throw error;
      }
    } catch (error) {
      logger.warn(`⚠️ Error scraping Instagram: ${(error as Error).message}`);
      return null;
    }
  }

  // ==========================================================================
  // FACEBOOK SCRAPING
  // ==========================================================================

  /**
   * Extraer datos de una página de Facebook
   */
  private async scrapeFacebook(facebookUrl: string): Promise<{
    pageName: string | null;
    emails: string[];
    phones: string[];
    website: string | null;
  } | null> {
    try {
      await this.initBrowser();
      if (!this.browser) return null;

      const page = await this.browser.newPage();

      try {
        await page.setUserAgent(antiDetection.getRandomUserAgent());

        // Normalizar URL de Facebook
        let url = facebookUrl;
        if (!url.includes("/about")) {
          // Ir a la página de información
          url = url.replace(/\/$/, "") + "/about";
        }

        logger.debug(`📘 Scraping Facebook: ${url}`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
        await this.sleep(2000 + Math.random() * 1000);

        // Extraer datos
        const data = await page.evaluate(() => {
          const result = {
            pageName: null as string | null,
            pageText: "",
          };

          // Nombre de la página
          const titleEl = document.querySelector("h1");
          if (titleEl) {
            result.pageName = titleEl.textContent?.trim() || null;
          }

          // Obtener todo el texto de la página para buscar emails y teléfonos
          result.pageText = document.body.innerText || "";

          return result;
        });

        // Extraer emails y teléfonos del texto
        const emails: string[] = [];
        const phones: string[] = [];
        let website: string | null = null;

        if (data.pageText) {
          // Emails
          const emailMatches = data.pageText.match(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
          );
          if (emailMatches) {
            emails.push(...emailMatches.filter((e) => this.isValidEmail(e)));
          }

          // Teléfonos
          const phoneMatches = data.pageText.match(
            /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d{1,3})[\s-]?\d{4}[\s-]?\d{4}/g
          );
          if (phoneMatches) {
            phones.push(...phoneMatches);
          }

          // Website
          const websiteMatch = data.pageText.match(
            /(?:sitio web|website|web)[:\s]*(https?:\/\/[^\s]+)/i
          );
          if (websiteMatch) {
            website = websiteMatch[1];
          }
        }

        await page.close();

        return {
          pageName: data.pageName,
          emails: [...new Set(emails)],
          phones: [...new Set(phones)],
          website,
        };
      } catch (error) {
        try {
          await page.close();
        } catch {}
        throw error;
      }
    } catch (error) {
      logger.warn(`⚠️ Error scraping Facebook: ${(error as Error).message}`);
      return null;
    }
  }

  // ==========================================================================
  // WEBSITE SCRAPING
  // ==========================================================================

  /**
   * Extraer datos de contacto de un sitio web
   * MEJORADO: Busca en más páginas y detecta emails ofuscados
   */
  private async scrapeWebsite(websiteUrl: string): Promise<{
    emails: string[];
    phones: string[];
    instagramUrl: string | null;
    facebookUrl: string | null;
  } | null> {
    try {
      const emails = new Set<string>();
      const phones = new Set<string>();
      let instagramUrl: string | null = null;
      let facebookUrl: string | null = null;

      const baseUrl = websiteUrl.replace(/\/$/, "");

      // Páginas a revisar (más exhaustivo)
      const pagesToCheck = [
        websiteUrl,
        `${baseUrl}/contacto`,
        `${baseUrl}/contact`,
        `${baseUrl}/contactenos`,
        `${baseUrl}/contact-us`,
        `${baseUrl}/nosotros`,
        `${baseUrl}/about`,
        `${baseUrl}/about-us`,
        `${baseUrl}/quienes-somos`,
        `${baseUrl}/empresa`,
        `${baseUrl}/footer`, // Algunos sitios tienen página de footer
      ];

      for (const pageUrl of pagesToCheck) {
        try {
          const response = await this.axiosInstance.get(pageUrl, {
            timeout: 8000,
          });
          const html = response.data;
          const $ = cheerio.load(html);

          // Obtener texto completo
          const text = $("body").text();
          const fullHtml = html.toString();

          // 1. Buscar emails normales en texto
          const emailMatches = text.match(EMAIL_REGEX);
          if (emailMatches) {
            emailMatches.forEach((e) => {
              if (this.isValidEmail(e)) emails.add(e.toLowerCase());
            });
          }

          // 2. Buscar emails en HTML raw (a veces están en atributos)
          const htmlEmailMatches = fullHtml.match(EMAIL_REGEX);
          if (htmlEmailMatches) {
            htmlEmailMatches.forEach((e: string) => {
              if (this.isValidEmail(e)) emails.add(e.toLowerCase());
            });
          }

          // 3. Buscar en atributos href="mailto:"
          $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const email = href.replace("mailto:", "").split("?")[0].trim();
            if (this.isValidEmail(email)) emails.add(email.toLowerCase());
          });

          // 4. Buscar emails ofuscados: info [at] domain [dot] com
          const obfuscatedMatches = text.match(
            /[a-zA-Z0-9._%+-]+\s*[\[\(]?\s*(?:at|@|arroba)\s*[\]\)]?\s*[a-zA-Z0-9.-]+\s*[\[\(]?\s*(?:dot|punto|\.)\s*[\]\)]?\s*[a-zA-Z]{2,}/gi
          );
          if (obfuscatedMatches) {
            obfuscatedMatches.forEach((match) => {
              const cleaned = match
                .replace(/\s*[\[\(]?\s*(?:at|arroba)\s*[\]\)]?\s*/gi, "@")
                .replace(/\s*[\[\(]?\s*(?:dot|punto)\s*[\]\)]?\s*/gi, ".")
                .replace(/\s+/g, "")
                .toLowerCase();
              if (this.isValidEmail(cleaned)) emails.add(cleaned);
            });
          }

          // 5. Buscar en data attributes y otros atributos
          $("[data-email], [data-mail]").each((_, el) => {
            const email = $(el).attr("data-email") || $(el).attr("data-mail");
            if (email && this.isValidEmail(email))
              emails.add(email.toLowerCase());
          });

          // 6. Buscar teléfonos
          const phoneMatchesAr = text.match(PHONE_REGEX_AR);
          if (phoneMatchesAr) phoneMatchesAr.forEach((p) => phones.add(p));

          const phoneMatchesIntl = text.match(PHONE_REGEX_INTL);
          if (phoneMatchesIntl) phoneMatchesIntl.forEach((p) => phones.add(p));

          // 7. Buscar en atributos href="tel:"
          $('a[href^="tel:"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const phone = href.replace("tel:", "").replace(/\s+/g, "");
            if (phone.length >= 8) phones.add(phone);
          });

          // 8. Buscar WhatsApp links
          $('a[href*="wa.me"], a[href*="whatsapp"]').each((_, el) => {
            const href = $(el).attr("href") || "";
            const phoneMatch = href.match(/[\d+]+/);
            if (phoneMatch && phoneMatch[0].length >= 8) {
              phones.add(phoneMatch[0]);
            }
          });

          // 9. Buscar redes sociales
          if (!instagramUrl) {
            const igMatch = fullHtml.match(
              /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i
            );
            if (igMatch) instagramUrl = igMatch[0];
          }

          if (!facebookUrl) {
            const fbMatch = fullHtml.match(
              /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.]+)/i
            );
            if (fbMatch) facebookUrl = fbMatch[0];
          }

          // Si encontramos al menos 1 email, es suficiente
          if (emails.size >= 1) {
            logger.debug(`📧 Website: encontrado email en ${pageUrl}`);
            break;
          }
        } catch {
          // Ignorar errores de páginas individuales (404, etc.)
        }
      }

      logger.debug(
        `📧 Website scrape result: ${emails.size} emails, ${phones.size} phones`
      );

      return {
        emails: [...emails].slice(0, 5),
        phones: [...phones].slice(0, 5),
        instagramUrl,
        facebookUrl,
      };
    } catch (error) {
      logger.warn(`⚠️ Error scraping website: ${(error as Error).message}`);
      return null;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private isSocialMediaUrl(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return SOCIAL_MEDIA_DOMAINS.some((domain) => lower.includes(domain));
  }

  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const lower = email.toLowerCase();

    // Verificar dominios ignorados
    for (const domain of IGNORED_EMAIL_DOMAINS) {
      if (lower.includes(domain)) return false;
    }

    // Verificar emails ignorados
    for (const ignored of IGNORED_EMAILS) {
      if (lower.includes(ignored)) return false;
    }

    // Verificar formato básico
    return EMAIL_REGEX.test(email);
  }

  private calculateEnrichmentScore(data: LeadContactData): number {
    let score = 0;

    // Email: +30 puntos (lo más importante)
    if (data.primaryEmail) score += 30;
    if (data.emails.length > 1) score += 5;

    // Teléfono: +20 puntos
    if (data.primaryPhone) score += 20;
    if (data.whatsappNumber) score += 5;

    // Website: +20 puntos
    if (data.hasRealWebsite) score += 20;

    // Instagram: +10 puntos
    if (data.instagramUrl) score += 5;
    if (data.instagramHandle) score += 3;
    if (data.instagramBio) score += 2;

    // Facebook: +5 puntos
    if (data.facebookUrl) score += 5;

    // Múltiples fuentes: +5 puntos
    if (data.enrichmentSources.length >= 3) score += 5;

    return Math.min(100, score);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
export const leadEnrichmentService = new LeadEnrichmentService();
export default leadEnrichmentService;
