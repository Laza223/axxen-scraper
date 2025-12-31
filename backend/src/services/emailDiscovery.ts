/**
 * 📧 EMAIL DISCOVERY SERVICE
 * Extrae emails de websites de negocios
 * Esta es una de las funcionalidades más valiosas para lead generation
 */

import puppeteer, { Browser, Page } from "puppeteer";
import antiDetection from "./antiDetection";
import logger from "./logger";

// Patrones de email válidos
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Dominios de email genéricos (menos valiosos)
const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
];

// Emails a ignorar (spam traps, ejemplos, etc.)
const IGNORED_EMAILS = [
  "example@example.com",
  "test@test.com",
  "email@email.com",
  "info@example.com",
  "no-reply@",
  "noreply@",
  "donotreply@",
  "mailer-daemon@",
];

// Páginas donde buscar emails (por prioridad)
const CONTACT_PAGES = [
  "/contacto",
  "/contact",
  "/contactenos",
  "/contact-us",
  "/about",
  "/nosotros",
  "/about-us",
  "/quienes-somos",
];

export interface EmailDiscoveryResult {
  emails: string[];
  primaryEmail: string | null;
  isBusinessEmail: boolean;
  socialLinks: SocialLinks;
  scrapedPages: string[];
  discoveryTime: number;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  whatsapp?: string;
}

// Patrones para detectar redes sociales
const SOCIAL_PATTERNS: Record<keyof SocialLinks, RegExp> = {
  instagram: /(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_.]+)/i,
  facebook: /(?:facebook\.com|fb\.com)\/([a-zA-Z0-9_.]+)/i,
  twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i,
  linkedin: /linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_-]+)/i,
  youtube: /youtube\.com\/(?:c\/|channel\/|user\/|@)?([a-zA-Z0-9_-]+)/i,
  tiktok: /tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
  whatsapp: /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?([\d+]+)/i,
};

class EmailDiscoveryService {
  private browser: Browser | null = null;

  /**
   * Inicializar navegador para descubrimiento de emails
   */
  async init(): Promise<void> {
    if (this.browser) return;

    const resolution = antiDetection.getRandomResolution();

    this.browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-images", // No cargar imágenes = más rápido
        "--disable-javascript", // No necesitamos JS para emails
        `--window-size=${resolution.width},${resolution.height}`,
      ],
      defaultViewport: resolution,
    });

    logger.info("📧 Email Discovery Service iniciado");
  }

  /**
   * Cerrar navegador
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Descubrir emails y redes sociales de un website
   */
  async discoverFromWebsite(websiteUrl: string): Promise<EmailDiscoveryResult> {
    const startTime = Date.now();
    const emails = new Set<string>();
    const socialLinks: SocialLinks = {};
    const scrapedPages: string[] = [];

    await this.init();
    if (!this.browser) {
      throw new Error("No se pudo iniciar el navegador");
    }

    const page = await this.browser.newPage();

    try {
      // Configurar página con anti-detección
      await page.setUserAgent(antiDetection.getRandomUserAgent());
      await page.setExtraHTTPHeaders(antiDetection.getRandomHeaders());

      // Timeout más agresivo para websites lentos
      page.setDefaultTimeout(15000);

      // 1. Scrapear página principal
      await this.scrapePage(page, websiteUrl, emails, socialLinks);
      scrapedPages.push(websiteUrl);

      // 2. Buscar páginas de contacto
      const baseUrl = new URL(websiteUrl).origin;

      for (const contactPath of CONTACT_PAGES) {
        if (emails.size >= 5) break; // Suficientes emails

        const contactUrl = baseUrl + contactPath;
        try {
          const response = await page.goto(contactUrl, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });

          if (response && response.status() === 200) {
            await this.scrapePage(page, contactUrl, emails, socialLinks);
            scrapedPages.push(contactUrl);
            await this.humanWait();
          }
        } catch {
          // Página no existe, continuar
        }
      }

      // 3. Procesar resultados
      const emailList = Array.from(emails);
      const primaryEmail = this.selectPrimaryEmail(emailList, baseUrl);
      const isBusinessEmail = primaryEmail
        ? this.isBusinessEmail(primaryEmail)
        : false;

      return {
        emails: emailList,
        primaryEmail,
        isBusinessEmail,
        socialLinks,
        scrapedPages,
        discoveryTime: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.warn(`⚠️ Error en email discovery: ${error.message}`);
      return {
        emails: [],
        primaryEmail: null,
        isBusinessEmail: false,
        socialLinks,
        scrapedPages,
        discoveryTime: Date.now() - startTime,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Scrapear una página individual
   */
  private async scrapePage(
    page: Page,
    url: string,
    emails: Set<string>,
    socialLinks: SocialLinks
  ): Promise<void> {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Extraer todo el contenido de la página
      const content = await page.evaluate(function () {
        // Texto visible
        var bodyText = document.body ? document.body.innerText : "";

        // Links (para emails en href="mailto:")
        var links = document.querySelectorAll("a[href]");
        var linkHrefs = [];
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute("href");
          if (href) linkHrefs.push(href);
        }

        // Meta tags (algunos sitios ponen email en meta)
        var metas = document.querySelectorAll("meta");
        var metaContent = [];
        for (var j = 0; j < metas.length; j++) {
          var content = metas[j].getAttribute("content");
          if (content) metaContent.push(content);
        }

        return {
          bodyText: bodyText,
          links: linkHrefs,
          metas: metaContent,
        };
      });

      // Buscar emails en texto
      const textEmails = content.bodyText.match(EMAIL_REGEX) || [];
      textEmails.forEach((email) => {
        if (this.isValidEmail(email)) {
          emails.add(email.toLowerCase());
        }
      });

      // Buscar emails en links (mailto:)
      content.links.forEach((link) => {
        if (link.startsWith("mailto:")) {
          const email = link.replace("mailto:", "").split("?")[0];
          if (this.isValidEmail(email)) {
            emails.add(email.toLowerCase());
          }
        }

        // Buscar redes sociales en links
        this.extractSocialLinks(link, socialLinks);
      });

      // Buscar emails en meta tags
      content.metas.forEach((meta) => {
        const metaEmails = meta.match(EMAIL_REGEX) || [];
        metaEmails.forEach((email) => {
          if (this.isValidEmail(email)) {
            emails.add(email.toLowerCase());
          }
        });
      });
    } catch (error: any) {
      logger.debug(`⚠️ Error scrapeando ${url}: ${error.message}`);
    }
  }

  /**
   * Extraer links de redes sociales
   */
  private extractSocialLinks(url: string, socialLinks: SocialLinks): void {
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      const match = url.match(pattern);
      if (match) {
        const key = platform as keyof SocialLinks;
        if (!socialLinks[key]) {
          socialLinks[key] = url;
        }
      }
    }
  }

  /**
   * Validar si un email es válido y útil
   */
  private isValidEmail(email: string): boolean {
    if (!email) return false;

    const lower = email.toLowerCase();

    // Ignorar emails conocidos inútiles
    for (const ignored of IGNORED_EMAILS) {
      if (lower.includes(ignored)) return false;
    }

    // Ignorar emails con extensiones de imagen (falsos positivos)
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(lower)) return false;

    // Verificar formato básico
    if (!EMAIL_REGEX.test(email)) return false;

    // Longitud razonable
    if (email.length < 5 || email.length > 100) return false;

    return true;
  }

  /**
   * Determinar si es un email de negocio (dominio propio)
   */
  private isBusinessEmail(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    return !GENERIC_EMAIL_DOMAINS.includes(domain);
  }

  /**
   * Seleccionar el email principal (más valioso)
   */
  private selectPrimaryEmail(
    emails: string[],
    websiteUrl: string
  ): string | null {
    if (emails.length === 0) return null;

    const domain = new URL(websiteUrl).hostname.replace("www.", "");

    // Prioridad 1: Email con dominio del website
    const domainEmail = emails.find((e) =>
      e.toLowerCase().includes(domain.split(".")[0])
    );
    if (domainEmail) return domainEmail;

    // Prioridad 2: Email de negocio (no Gmail/Hotmail)
    const businessEmail = emails.find((e) => this.isBusinessEmail(e));
    if (businessEmail) return businessEmail;

    // Prioridad 3: Emails que contengan palabras clave
    const priorityKeywords = [
      "info",
      "contacto",
      "contact",
      "ventas",
      "sales",
      "admin",
    ];
    for (const keyword of priorityKeywords) {
      const match = emails.find((e) => e.toLowerCase().includes(keyword));
      if (match) return match;
    }

    // Default: primer email
    return emails[0];
  }

  /**
   * Espera humanizada
   */
  private async humanWait(): Promise<void> {
    const delay = antiDetection.humanDelay(500, 1500);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Descubrir emails de múltiples websites en paralelo
   */
  async discoverBatch(
    websites: string[],
    concurrency: number = 3
  ): Promise<Map<string, EmailDiscoveryResult>> {
    const results = new Map<string, EmailDiscoveryResult>();

    // Procesar en lotes para no sobrecargar
    for (let i = 0; i < websites.length; i += concurrency) {
      const batch = websites.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            const result = await this.discoverFromWebsite(url);
            return { url, result };
          } catch (error) {
            return {
              url,
              result: {
                emails: [],
                primaryEmail: null,
                isBusinessEmail: false,
                socialLinks: {},
                scrapedPages: [],
                discoveryTime: 0,
              } as EmailDiscoveryResult,
            };
          }
        })
      );

      batchResults.forEach(({ url, result }) => {
        results.set(url, result);
      });

      // Pausa entre lotes
      if (i + concurrency < websites.length) {
        await this.humanWait();
      }
    }

    return results;
  }
}

export const emailDiscoveryService = new EmailDiscoveryService();
export default emailDiscoveryService;
