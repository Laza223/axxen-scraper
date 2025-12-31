import axios from "axios";
import * as cheerio from "cheerio";
import cacheService from "./cacheService";
import logger from "./logger";

/**
 * 🔍 Tech Stack Detector - Detecta tecnologías usadas en websites
 *
 * Analiza el HTML, headers y scripts para identificar:
 * - CMS (WordPress, Shopify, Wix, etc.)
 * - Frameworks (React, Vue, Angular, etc.)
 * - Hosting/CDN (Cloudflare, AWS, etc.)
 * - Analytics y Marketing tools
 * - Herramientas de e-commerce
 */

export interface TechStack {
  cms?: string;
  framework?: string;
  hosting?: string;
  ecommerce?: string;
  analytics: string[];
  marketing: string[];
  security: string[];
  performance: string[];
  other: string[];
  // Resumen
  complexity: "basic" | "intermediate" | "advanced";
  estimatedBudget: "low" | "medium" | "high";
  modernScore: number; // 0-100
}

// Patrones de detección
const TECH_PATTERNS = {
  // CMS
  cms: [
    {
      name: "WordPress",
      patterns: ["wp-content", "wp-includes", "wordpress", "/wp-json/"],
      weight: 1,
    },
    {
      name: "Shopify",
      patterns: ["cdn.shopify.com", "shopify", "myshopify.com"],
      weight: 1,
    },
    {
      name: "Wix",
      patterns: ["wix.com", "wixsite.com", "static.wixstatic.com", "wix-code"],
      weight: 1,
    },
    {
      name: "Squarespace",
      patterns: ["squarespace.com", "sqsp.net", "static.squarespace.com"],
      weight: 1,
    },
    {
      name: "Webflow",
      patterns: ["webflow.com", "webflow.io", "wf-cdn.com"],
      weight: 1,
    },
    {
      name: "Drupal",
      patterns: ["/sites/default/files", "drupal", "/node/", "drupal.js"],
      weight: 1,
    },
    {
      name: "Joomla",
      patterns: ["/components/com_", "/media/jui/", "joomla"],
      weight: 1,
    },
    {
      name: "Ghost",
      patterns: ["ghost.io", "ghost.org", "/ghost/"],
      weight: 1,
    },
    { name: "Blogger", patterns: ["blogspot.com", "blogger.com"], weight: 1 },
    { name: "Weebly", patterns: ["weebly.com", "editmysite.com"], weight: 1 },
    {
      name: "PrestaShop",
      patterns: ["prestashop", "/modules/", "presta"],
      weight: 1,
    },
    {
      name: "Magento",
      patterns: ["mage", "magento", "/static/version"],
      weight: 1,
    },
    {
      name: "WooCommerce",
      patterns: ["woocommerce", "wc-", "/wc-api/"],
      weight: 1,
    },
    { name: "STARTER", patterns: ["starter.com.ar", "starter.ar"], weight: 1 },
    { name: "Tiendanube", patterns: ["tiendanube", "nuvemshop"], weight: 1 },
    { name: "MercadoShops", patterns: ["mercadoshops.com"], weight: 1 },
    { name: "Empretienda", patterns: ["empretienda.com.ar"], weight: 1 },
  ],

  // Frameworks JS
  framework: [
    {
      name: "React",
      patterns: [
        "react",
        "__NEXT_DATA__",
        "_next/",
        "reactroot",
        "data-reactroot",
      ],
      weight: 1,
    },
    {
      name: "Next.js",
      patterns: ["__NEXT_DATA__", "_next/static", "next/"],
      weight: 2,
    },
    {
      name: "Vue.js",
      patterns: ["vue", "__vue__", "v-if", "v-for", "nuxt"],
      weight: 1,
    },
    { name: "Nuxt.js", patterns: ["__NUXT__", "_nuxt/", "nuxt"], weight: 2 },
    { name: "Angular", patterns: ["ng-", "angular", "ng-version"], weight: 1 },
    { name: "Svelte", patterns: ["svelte", "__svelte"], weight: 1 },
    { name: "jQuery", patterns: ["jquery", "jQuery"], weight: 0.5 },
    {
      name: "Bootstrap",
      patterns: ["bootstrap", "btn-primary", "container-fluid"],
      weight: 0.5,
    },
    {
      name: "Tailwind CSS",
      patterns: ["tailwind", "tw-", "flex ", "grid ", "bg-"],
      weight: 1,
    },
    {
      name: "Gatsby",
      patterns: ["gatsby", "/static/", "___gatsby"],
      weight: 2,
    },
  ],

  // Hosting/CDN
  hosting: [
    {
      name: "Cloudflare",
      patterns: ["cloudflare", "cf-ray", "cloudflareinsights"],
      weight: 1,
    },
    {
      name: "AWS CloudFront",
      patterns: ["cloudfront.net", "amazonaws.com"],
      weight: 1,
    },
    {
      name: "Vercel",
      patterns: ["vercel", "now.sh", "vercel-analytics"],
      weight: 1,
    },
    {
      name: "Netlify",
      patterns: ["netlify", "netlify.app", "netlify-identity"],
      weight: 1,
    },
    { name: "Heroku", patterns: ["herokuapp.com"], weight: 1 },
    { name: "DigitalOcean", patterns: ["digitalocean"], weight: 1 },
    { name: "GoDaddy", patterns: ["godaddy", "secureserver.net"], weight: 1 },
    { name: "Bluehost", patterns: ["bluehost"], weight: 1 },
    { name: "Hostinger", patterns: ["hostinger"], weight: 1 },
    { name: "SiteGround", patterns: ["siteground", "sgvps"], weight: 1 },
    { name: "WP Engine", patterns: ["wpengine", "wpe.com"], weight: 1 },
    { name: "Kinsta", patterns: ["kinsta"], weight: 1 },
  ],

  // E-commerce
  ecommerce: [
    { name: "Shopify", patterns: ["shopify", "myshopify"], weight: 1 },
    {
      name: "WooCommerce",
      patterns: ["woocommerce", "wc-", "add-to-cart"],
      weight: 1,
    },
    { name: "Magento", patterns: ["magento", "/checkout/cart"], weight: 1 },
    { name: "PrestaShop", patterns: ["prestashop", "presta"], weight: 1 },
    { name: "BigCommerce", patterns: ["bigcommerce"], weight: 1 },
    { name: "Tiendanube", patterns: ["tiendanube", "nuvemshop"], weight: 1 },
    { name: "VTEX", patterns: ["vtex", "vteximg"], weight: 1 },
    { name: "Stripe", patterns: ["stripe.com", "js.stripe.com"], weight: 0.8 },
    { name: "PayPal", patterns: ["paypal.com", "paypalobjects"], weight: 0.8 },
    {
      name: "MercadoPago",
      patterns: ["mercadopago", "mercadolibre"],
      weight: 0.8,
    },
  ],

  // Analytics
  analytics: [
    {
      name: "Google Analytics",
      patterns: [
        "google-analytics",
        "googletagmanager",
        "gtag",
        "ga.js",
        "analytics.js",
        "UA-",
      ],
      weight: 1,
    },
    {
      name: "Google Tag Manager",
      patterns: ["googletagmanager", "gtm.js", "GTM-"],
      weight: 1,
    },
    {
      name: "Facebook Pixel",
      patterns: ["facebook.net/en_US/fbevents", "fbq(", "FB_PIXEL"],
      weight: 1,
    },
    {
      name: "Hotjar",
      patterns: ["hotjar.com", "static.hotjar.com", "hj("],
      weight: 1,
    },
    { name: "Mixpanel", patterns: ["mixpanel.com", "mixpanel"], weight: 1 },
    { name: "Amplitude", patterns: ["amplitude.com", "amplitude"], weight: 1 },
    { name: "Heap", patterns: ["heapanalytics", "heap.js"], weight: 1 },
    {
      name: "Segment",
      patterns: ["segment.com", "segment.io", "analytics.js"],
      weight: 1,
    },
    {
      name: "Clarity",
      patterns: ["clarity.ms", "microsoft clarity"],
      weight: 1,
    },
    { name: "Plausible", patterns: ["plausible.io"], weight: 1 },
  ],

  // Marketing tools
  marketing: [
    {
      name: "Mailchimp",
      patterns: ["mailchimp", "list-manage.com", "chimpstatic"],
      weight: 1,
    },
    {
      name: "HubSpot",
      patterns: ["hubspot", "hs-scripts", "hs-analytics"],
      weight: 1,
    },
    { name: "Intercom", patterns: ["intercom", "intercomcdn"], weight: 1 },
    { name: "Drift", patterns: ["drift.com", "driftt.com"], weight: 1 },
    { name: "Crisp", patterns: ["crisp.chat", "crisp.im"], weight: 1 },
    { name: "Tidio", patterns: ["tidio", "tidiochat"], weight: 1 },
    { name: "Zendesk", patterns: ["zendesk", "zdassets"], weight: 1 },
    { name: "Freshdesk", patterns: ["freshdesk", "freshchat"], weight: 1 },
    { name: "Tawk.to", patterns: ["tawk.to", "embed.tawk"], weight: 1 },
    {
      name: "WhatsApp Business",
      patterns: ["wa.me", "whatsapp.com/catalog"],
      weight: 1,
    },
    { name: "OptinMonster", patterns: ["optinmonster"], weight: 1 },
    { name: "Sumo", patterns: ["sumo.com", "sumome"], weight: 1 },
  ],

  // Security
  security: [
    {
      name: "reCAPTCHA",
      patterns: ["google.com/recaptcha", "grecaptcha"],
      weight: 1,
    },
    { name: "hCaptcha", patterns: ["hcaptcha.com"], weight: 1 },
    {
      name: "Cloudflare Security",
      patterns: ["cf-browser-verification", "challenge-platform"],
      weight: 1,
    },
    { name: "SSL Certificate", patterns: ["https://"], weight: 0.5 },
    { name: "Sucuri", patterns: ["sucuri", "sucuricdn"], weight: 1 },
    { name: "Wordfence", patterns: ["wordfence"], weight: 1 },
  ],

  // Performance
  performance: [
    {
      name: "Lazy Loading",
      patterns: ['loading="lazy"', "lazyload", "data-src"],
      weight: 1,
    },
    {
      name: "Image CDN",
      patterns: ["cloudinary", "imgix", "imagekit", "fastly"],
      weight: 1,
    },
    { name: "Service Worker", patterns: ["serviceWorker", "sw.js"], weight: 1 },
    { name: "PWA", patterns: ["manifest.json", "web-app-manifest"], weight: 1 },
    { name: "AMP", patterns: ["amp-", "ampproject.org"], weight: 1 },
    { name: "WebP Images", patterns: [".webp"], weight: 0.5 },
    { name: "HTTP/2", patterns: [], weight: 0 }, // Detectar por headers
  ],
};

class TechStackDetector {
  private axiosInstance = axios.create({
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    },
    validateStatus: (status) => status < 500,
  });

  /**
   * Detectar stack tecnológico de un website
   */
  async detect(url?: string): Promise<TechStack | null> {
    if (!url) return null;

    // Normalizar URL
    url = this.normalizeUrl(url);

    // Cache
    const cacheKey = `techstack:${url}`;
    const cached = await cacheService.get<TechStack>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.axiosInstance.get(url);
      const html = response.data.toLowerCase();
      const headers = response.headers;
      const $ = cheerio.load(response.data);

      const stack: TechStack = {
        analytics: [],
        marketing: [],
        security: [],
        performance: [],
        other: [],
        complexity: "basic",
        estimatedBudget: "low",
        modernScore: 0,
      };

      // Detectar cada categoría
      stack.cms = this.detectCategory(html, $, headers, TECH_PATTERNS.cms);
      stack.framework = this.detectCategory(
        html,
        $,
        headers,
        TECH_PATTERNS.framework
      );
      stack.hosting =
        this.detectCategory(html, $, headers, TECH_PATTERNS.hosting) ||
        this.detectHostingFromHeaders(headers);
      stack.ecommerce = this.detectCategory(
        html,
        $,
        headers,
        TECH_PATTERNS.ecommerce
      );

      stack.analytics = this.detectMultiple(html, $, TECH_PATTERNS.analytics);
      stack.marketing = this.detectMultiple(html, $, TECH_PATTERNS.marketing);
      stack.security = this.detectMultiple(html, $, TECH_PATTERNS.security);
      stack.performance = this.detectMultiple(
        html,
        $,
        TECH_PATTERNS.performance
      );

      // Detectar HTTP/2 desde headers
      if (headers[":status"] || response.request?.res?.httpVersion === "2.0") {
        stack.performance.push("HTTP/2");
      }

      // Calcular métricas
      stack.complexity = this.calculateComplexity(stack);
      stack.estimatedBudget = this.calculateBudget(stack);
      stack.modernScore = this.calculateModernScore(stack);

      // Guardar en cache (24 horas)
      await cacheService.set(cacheKey, stack, 86400);

      logger.debug(
        `🔍 Stack detectado para ${url}: ${stack.cms || "Custom"} | ${
          stack.framework || "Vanilla"
        }`
      );

      return stack;
    } catch (error: any) {
      logger.warn(`⚠️ Error detectando stack de ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Detectar una categoría (devuelve el primero encontrado)
   */
  private detectCategory(
    html: string,
    $: cheerio.CheerioAPI,
    headers: any,
    patterns: { name: string; patterns: string[]; weight: number }[]
  ): string | undefined {
    for (const tech of patterns) {
      for (const pattern of tech.patterns) {
        if (html.includes(pattern.toLowerCase())) {
          return tech.name;
        }
      }
    }
    return undefined;
  }

  /**
   * Detectar múltiples tecnologías de una categoría
   */
  private detectMultiple(
    html: string,
    $: cheerio.CheerioAPI,
    patterns: { name: string; patterns: string[]; weight: number }[]
  ): string[] {
    const detected: string[] = [];

    for (const tech of patterns) {
      for (const pattern of tech.patterns) {
        if (html.includes(pattern.toLowerCase())) {
          if (!detected.includes(tech.name)) {
            detected.push(tech.name);
          }
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Detectar hosting desde headers
   */
  private detectHostingFromHeaders(headers: any): string | undefined {
    const server = headers["server"]?.toLowerCase() || "";
    const powered = headers["x-powered-by"]?.toLowerCase() || "";
    const via = headers["via"]?.toLowerCase() || "";

    if (server.includes("cloudflare") || headers["cf-ray"]) return "Cloudflare";
    if (server.includes("nginx")) return "Nginx";
    if (server.includes("apache")) return "Apache";
    if (via.includes("cloudfront")) return "AWS CloudFront";
    if (powered.includes("wp engine")) return "WP Engine";
    if (server.includes("vercel")) return "Vercel";
    if (server.includes("netlify")) return "Netlify";

    return undefined;
  }

  /**
   * Calcular complejidad del stack
   */
  private calculateComplexity(
    stack: TechStack
  ): "basic" | "intermediate" | "advanced" {
    let score = 0;

    // CMS básico
    if (["Wix", "Squarespace", "Weebly", "Blogger"].includes(stack.cms || "")) {
      score += 1;
    } else if (["WordPress", "Shopify", "Webflow"].includes(stack.cms || "")) {
      score += 2;
    } else if (["Drupal", "Magento", "Custom"].includes(stack.cms || "")) {
      score += 3;
    }

    // Framework moderno
    if (
      ["React", "Vue.js", "Angular", "Svelte"].includes(stack.framework || "")
    ) {
      score += 2;
    }
    if (["Next.js", "Nuxt.js", "Gatsby"].includes(stack.framework || "")) {
      score += 3;
    }

    // Herramientas adicionales
    score += stack.analytics.length * 0.3;
    score += stack.marketing.length * 0.3;
    score += stack.performance.length * 0.5;

    if (score <= 2) return "basic";
    if (score <= 5) return "intermediate";
    return "advanced";
  }

  /**
   * Estimar presupuesto del sitio
   */
  private calculateBudget(stack: TechStack): "low" | "medium" | "high" {
    // Plataformas gratuitas/baratas
    if (
      ["Wix", "Weebly", "Blogger", "WordPress.com"].includes(stack.cms || "")
    ) {
      return "low";
    }

    // E-commerce o CMS premium
    if (
      stack.ecommerce ||
      ["Shopify", "Magento", "WooCommerce"].includes(stack.cms || "")
    ) {
      return "high";
    }

    // Framework moderno = desarrollo custom
    if (
      ["Next.js", "Nuxt.js", "Gatsby", "React", "Vue.js"].includes(
        stack.framework || ""
      )
    ) {
      return "high";
    }

    // WordPress con muchas herramientas
    if (
      stack.cms === "WordPress" &&
      (stack.marketing.length >= 2 || stack.analytics.length >= 2)
    ) {
      return "medium";
    }

    return "medium";
  }

  /**
   * Calcular score de modernidad (0-100)
   */
  private calculateModernScore(stack: TechStack): number {
    let score = 0;

    // Framework moderno (+30)
    if (["Next.js", "Nuxt.js", "Gatsby"].includes(stack.framework || "")) {
      score += 30;
    } else if (["React", "Vue.js", "Svelte"].includes(stack.framework || "")) {
      score += 25;
    } else if (stack.framework === "Tailwind CSS") {
      score += 15;
    }

    // Hosting moderno (+15)
    if (["Vercel", "Netlify", "Cloudflare"].includes(stack.hosting || "")) {
      score += 15;
    } else if (["AWS CloudFront", "WP Engine"].includes(stack.hosting || "")) {
      score += 10;
    }

    // Performance features (+5 cada)
    if (stack.performance.includes("PWA")) score += 10;
    if (stack.performance.includes("Service Worker")) score += 5;
    if (stack.performance.includes("Lazy Loading")) score += 5;
    if (stack.performance.includes("WebP Images")) score += 5;
    if (stack.performance.includes("HTTP/2")) score += 5;

    // Analytics moderno (+5)
    if (stack.analytics.includes("Google Tag Manager")) score += 5;
    if (stack.analytics.includes("Segment")) score += 5;

    // Security (+5)
    if (stack.security.includes("SSL Certificate")) score += 5;
    if (stack.security.length >= 2) score += 5;

    return Math.min(100, score);
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
    return url.replace(/\/+$/, "");
  }

  /**
   * Generar resumen legible del stack
   */
  summarize(stack: TechStack): string {
    const parts: string[] = [];

    if (stack.cms) parts.push(`CMS: ${stack.cms}`);
    if (stack.framework) parts.push(`Framework: ${stack.framework}`);
    if (stack.ecommerce) parts.push(`E-commerce: ${stack.ecommerce}`);
    if (stack.hosting) parts.push(`Hosting: ${stack.hosting}`);

    return parts.join(" | ") || "Stack básico/desconocido";
  }

  /**
   * Identificar oportunidades basadas en el stack
   */
  identifyOpportunities(stack: TechStack): string[] {
    const opportunities: string[] = [];

    // Stack básico = oportunidad de modernización
    if (stack.complexity === "basic") {
      opportunities.push("💰 Modernización del sitio web completo");
    }

    // Sin e-commerce pero tiene tienda
    if (
      !stack.ecommerce &&
      (stack.cms === "WordPress" || stack.cms === "Wix")
    ) {
      opportunities.push("💰 Integración de tienda online");
    }

    // Sin analytics
    if (stack.analytics.length === 0) {
      opportunities.push("💰 Configuración de analytics y métricas");
    }

    // Sin marketing automation
    if (stack.marketing.length === 0) {
      opportunities.push("💰 Automatización de marketing");
    }

    // Wix/Weebly = migración
    if (["Wix", "Weebly", "Squarespace"].includes(stack.cms || "")) {
      opportunities.push("💰 Migración a plataforma más flexible");
    }

    // WordPress viejo
    if (stack.cms === "WordPress" && stack.modernScore < 30) {
      opportunities.push("💰 Optimización y actualización de WordPress");
    }

    // Sin PWA
    if (!stack.performance.includes("PWA") && stack.modernScore > 40) {
      opportunities.push("💰 Implementación de PWA");
    }

    // Sin performance optimization
    if (stack.performance.length < 2) {
      opportunities.push("💰 Optimización de velocidad");
    }

    return opportunities;
  }
}

export const techStackDetector = new TechStackDetector();
export default techStackDetector;
