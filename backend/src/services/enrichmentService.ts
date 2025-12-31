import axios from "axios";
import * as cheerio from "cheerio";
import cacheService from "./cacheService";
import logger from "./logger";

export interface WebsiteAnalysis {
  hasWebsite: boolean;
  url?: string;
  status: "none" | "parked" | "generic" | "active" | "error" | "redirect";
  loadTime?: number;
  issues: string[];

  // Funcionalidades
  hasContactForm: boolean;
  hasWhatsAppWidget: boolean;
  hasLiveChat: boolean;
  hasSslCertificate: boolean;
  isMobileResponsive: boolean;

  // Contacto encontrado
  emails: string[];
  phones: string[];

  // Redes sociales
  socialMedia: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
  };
}

export interface EnrichmentResult {
  websiteAnalysis: WebsiteAnalysis;
  estimatedRevenue: "Low" | "Medium" | "High";
  painPoints: string[];
  opportunities: string[];
  leadScore: number;
}

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?54\s?)?(?:9\s?)?(?:11|[2368]\d)\s?\d{4}[-\s]?\d{4}/g;

// Dominios parqueados conocidos
const PARKED_DOMAINS = [
  "godaddy.com",
  "sedoparking.com",
  "parkingcrew.net",
  "bodis.com",
  "hugedomains.com",
  "dan.com",
];

// Frases de sitios genéricos/en construcción
const GENERIC_PHRASES = [
  "coming soon",
  "próximamente",
  "under construction",
  "sitio en construcción",
  "lorem ipsum",
  "pagina en construccion",
  "estamos trabajando",
  "muy pronto",
  "launching soon",
];

// Plataformas de chat
const CHAT_WIDGETS = [
  "tawk.to",
  "intercom",
  "drift",
  "crisp.chat",
  "livechat",
  "zendesk",
  "freshchat",
  "hubspot",
  "tidio",
  "olark",
  "jivochat",
  "chatra",
  "smartsupp",
];

class EnrichmentService {
  private axiosInstance = axios.create({
    timeout: 10000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
    },
    validateStatus: (status) => status < 500, // No fallar en 4xx
  });

  /**
   * Analizar website completo
   */
  async analyzeWebsite(url?: string): Promise<WebsiteAnalysis> {
    // Sin website
    if (!url) {
      return this.createEmptyAnalysis();
    }

    // Normalizar URL
    url = this.normalizeUrl(url);

    // Buscar en caché
    const cached = await cacheService.getCachedWebsiteAnalysis(url);
    if (cached) {
      return cached;
    }

    try {
      const startTime = Date.now();
      const response = await this.axiosInstance.get(url);
      const loadTime = Date.now() - startTime;

      const html = response.data;
      const $ = cheerio.load(html);
      const textContent = $("body").text().toLowerCase();
      const fullHtml = html.toLowerCase();

      // Analizar SSL
      const hasSsl = url.startsWith("https://");

      // Detectar redirección a dominio parqueado
      const finalUrl = response.request?.res?.responseUrl || url;
      const isParked = this.isParkedDomain(finalUrl, textContent);

      // Detectar sitio genérico
      const isGeneric = this.isGenericSite(textContent);

      // Detectar funcionalidades
      const hasContactForm = this.hasContactForm($);
      const hasWhatsApp = this.hasWhatsAppWidget($, fullHtml);
      const hasLiveChat = this.hasLiveChatWidget(fullHtml);
      const isMobileResponsive = this.checkMobileResponsive($);

      // Extraer datos de contacto
      const emails = this.extractEmails(textContent, fullHtml);
      const phones = this.extractPhones(textContent);

      // Extraer redes sociales
      const socialMedia = this.extractSocialMedia($);

      // Determinar issues
      const issues = this.identifyIssues({
        hasContactForm,
        hasWhatsApp,
        hasLiveChat,
        hasSsl,
        isMobileResponsive,
        loadTime,
        isParked,
        isGeneric,
        emails,
      });

      // Determinar status
      let status: WebsiteAnalysis["status"] = "active";
      if (isParked) status = "parked";
      else if (isGeneric) status = "generic";
      else if (finalUrl !== url && !finalUrl.includes(new URL(url).hostname)) {
        status = "redirect";
      }

      const analysis: WebsiteAnalysis = {
        hasWebsite: true,
        url: finalUrl,
        status,
        loadTime,
        issues,
        hasContactForm,
        hasWhatsAppWidget: hasWhatsApp,
        hasLiveChat,
        hasSslCertificate: hasSsl,
        isMobileResponsive,
        emails,
        phones,
        socialMedia,
      };

      // Guardar en caché
      await cacheService.setCachedWebsiteAnalysis(url, analysis);

      return analysis;
    } catch (error: any) {
      logger.warn(`⚠️ Error analizando ${url}: ${error.message}`);

      const analysis: WebsiteAnalysis = {
        hasWebsite: true,
        url,
        status: "error",
        issues: ["Website no accesible o bloqueado"],
        hasContactForm: false,
        hasWhatsAppWidget: false,
        hasLiveChat: false,
        hasSslCertificate: false,
        isMobileResponsive: false,
        emails: [],
        phones: [],
        socialMedia: {},
      };

      await cacheService.setCachedWebsiteAnalysis(url, analysis);
      return analysis;
    }
  }

  /**
   * Enriquecer lead con análisis completo
   */
  async enrichLead(data: {
    businessName: string;
    category: string;
    googleRating?: number;
    reviewCount: number;
    websiteUrl?: string;
    phoneRaw?: string;
    location: string;
  }): Promise<EnrichmentResult> {
    // Analizar website
    const websiteAnalysis = await this.analyzeWebsite(data.websiteUrl);

    // Calcular score
    const leadScore = this.calculateLeadScore({
      reviewCount: data.reviewCount,
      googleRating: data.googleRating,
      websiteAnalysis,
      hasPhone: !!data.phoneRaw,
    });

    // Estimar revenue
    const estimatedRevenue = this.estimateRevenue({
      reviewCount: data.reviewCount,
      googleRating: data.googleRating,
      category: data.category,
      location: data.location,
    });

    // Identificar pain points y oportunidades
    const painPoints = this.identifyPainPoints(websiteAnalysis, data);
    const opportunities = this.identifyOpportunities(websiteAnalysis, data);

    return {
      websiteAnalysis,
      estimatedRevenue,
      painPoints,
      opportunities,
      leadScore,
    };
  }

  // ==================== HELPERS ====================

  private createEmptyAnalysis(): WebsiteAnalysis {
    return {
      hasWebsite: false,
      status: "none",
      issues: ["Sin presencia web - perdiendo clientes online"],
      hasContactForm: false,
      hasWhatsAppWidget: false,
      hasLiveChat: false,
      hasSslCertificate: false,
      isMobileResponsive: false,
      emails: [],
      phones: [],
      socialMedia: {},
    };
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
    return url.replace(/\/+$/, ""); // Quitar trailing slashes
  }

  private isParkedDomain(url: string, text: string): boolean {
    // Check URL
    if (PARKED_DOMAINS.some((d) => url.includes(d))) return true;

    // Check content
    const parkedPhrases = [
      "domain for sale",
      "buy this domain",
      "domain expired",
      "this domain is parked",
      "parked domain",
      "make an offer",
      "dominio en venta",
      "este dominio está en venta",
    ];
    return parkedPhrases.some((p) => text.includes(p));
  }

  private isGenericSite(text: string): boolean {
    return GENERIC_PHRASES.some((p) => text.includes(p));
  }

  private hasContactForm($: cheerio.CheerioAPI): boolean {
    // Buscar forms con campos típicos de contacto
    const forms = $("form");
    let hasContact = false;

    forms.each((_, form) => {
      const formHtml = $(form).html()?.toLowerCase() || "";
      const hasEmail =
        formHtml.includes("email") || formHtml.includes("correo");
      const hasName = formHtml.includes("name") || formHtml.includes("nombre");
      const hasMessage =
        formHtml.includes("message") ||
        formHtml.includes("mensaje") ||
        $(form).find("textarea").length > 0;

      if ((hasEmail || hasName) && hasMessage) {
        hasContact = true;
      }
    });

    return hasContact;
  }

  private hasWhatsAppWidget($: cheerio.CheerioAPI, html: string): boolean {
    // Links directos
    const waLinks =
      $('a[href*="wa.me"], a[href*="whatsapp"], a[href*="api.whatsapp"]')
        .length > 0;

    // Widgets comunes
    const widgetPatterns = [
      "wa.me",
      "api.whatsapp",
      "whatsapp-widget",
      "whatshelp",
      "elfsight.com/whatsapp",
      "getbutton.io",
      "callbell",
    ];
    const hasWidget = widgetPatterns.some((p) => html.includes(p));

    return waLinks || hasWidget;
  }

  private hasLiveChatWidget(html: string): boolean {
    return CHAT_WIDGETS.some((chat) => html.includes(chat));
  }

  private checkMobileResponsive($: cheerio.CheerioAPI): boolean {
    // Check viewport meta
    const hasViewport = $('meta[name="viewport"]').length > 0;

    // Check media queries en styles inline (aproximación)
    const styles = $("style").text();
    const hasMediaQueries =
      styles.includes("@media") &&
      (styles.includes("max-width") || styles.includes("min-width"));

    // Check Bootstrap o Tailwind
    const hasFramework =
      $('[class*="col-"], [class*="sm:"], [class*="md:"], [class*="lg:"]')
        .length > 0;

    return hasViewport && (hasMediaQueries || hasFramework);
  }

  private extractEmails(text: string, html: string): string[] {
    const combined = text + " " + html;
    const matches = combined.match(EMAIL_REGEX) || [];

    // Filtrar emails falsos
    const filtered = matches.filter((email) => {
      const lower = email.toLowerCase();
      return (
        !lower.includes("example") &&
        !lower.includes("test") &&
        !lower.includes("wixpress") &&
        !lower.includes("sentry") &&
        !lower.includes("@2x") &&
        !lower.endsWith(".png") &&
        !lower.endsWith(".jpg")
      );
    });

    // Únicos
    return [...new Set(filtered)].slice(0, 5);
  }

  private extractPhones(text: string): string[] {
    const matches = text.match(PHONE_REGEX) || [];
    return [...new Set(matches)].slice(0, 3);
  }

  private extractSocialMedia(
    $: cheerio.CheerioAPI
  ): WebsiteAnalysis["socialMedia"] {
    const social: WebsiteAnalysis["socialMedia"] = {};

    // Facebook
    const fb = $('a[href*="facebook.com/"], a[href*="fb.com/"]')
      .first()
      .attr("href");
    if (fb && !fb.includes("sharer")) social.facebook = fb;

    // Instagram
    const ig = $('a[href*="instagram.com/"]').first().attr("href");
    if (ig) social.instagram = ig;

    // LinkedIn
    const li = $('a[href*="linkedin.com/"]').first().attr("href");
    if (li && !li.includes("share")) social.linkedin = li;

    // Twitter/X
    const tw = $('a[href*="twitter.com/"], a[href*="x.com/"]')
      .first()
      .attr("href");
    if (tw && !tw.includes("intent")) social.twitter = tw;

    // YouTube
    const yt = $('a[href*="youtube.com/"]').first().attr("href");
    if (yt && !yt.includes("embed")) social.youtube = yt;

    // TikTok
    const tt = $('a[href*="tiktok.com/"]').first().attr("href");
    if (tt) social.tiktok = tt;

    return social;
  }

  private identifyIssues(data: {
    hasContactForm: boolean;
    hasWhatsApp: boolean;
    hasLiveChat: boolean;
    hasSsl: boolean;
    isMobileResponsive: boolean;
    loadTime: number;
    isParked: boolean;
    isGeneric: boolean;
    emails: string[];
  }): string[] {
    const issues: string[] = [];

    if (data.isParked) {
      issues.push("Dominio parqueado o expirado");
    }
    if (data.isGeneric) {
      issues.push("Sitio genérico o en construcción");
    }
    if (!data.hasSsl) {
      issues.push("Sin certificado SSL (no seguro)");
    }
    if (!data.hasContactForm && data.emails.length === 0) {
      issues.push("Sin formulario de contacto");
    }
    if (!data.hasWhatsApp) {
      issues.push("Sin integración de WhatsApp");
    }
    if (!data.hasLiveChat) {
      issues.push("Sin chat en vivo");
    }
    if (!data.isMobileResponsive) {
      issues.push("No optimizado para móviles");
    }
    if (data.loadTime > 4000) {
      issues.push(`Carga lenta (${(data.loadTime / 1000).toFixed(1)}s)`);
    }

    return issues;
  }

  private calculateLeadScore(data: {
    reviewCount: number;
    googleRating?: number;
    websiteAnalysis: WebsiteAnalysis;
    hasPhone: boolean;
  }): number {
    let score = 0;

    // Reviews (máx 35 pts) - Indica demanda real
    if (data.reviewCount >= 200) score += 35;
    else if (data.reviewCount >= 100) score += 30;
    else if (data.reviewCount >= 50) score += 25;
    else if (data.reviewCount >= 25) score += 20;
    else if (data.reviewCount >= 10) score += 15;
    else if (data.reviewCount >= 5) score += 10;

    // Rating (máx 15 pts) - Indica calidad
    const rating = data.googleRating || 0;
    if (rating >= 4.5) score += 15;
    else if (rating >= 4.0) score += 12;
    else if (rating >= 3.5) score += 8;
    else if (rating >= 3.0) score += 5;

    // Estado del website (máx 40 pts) - ¡LA OPORTUNIDAD!
    const ws = data.websiteAnalysis;
    if (ws.status === "none") {
      score += 40; // 🎯 JACKPOT - No tienen nada
    } else if (ws.status === "parked") {
      score += 35; // Dominio muerto
    } else if (ws.status === "generic") {
      score += 30; // Template vacío
    } else if (ws.status === "error") {
      score += 25; // Website roto
    } else {
      // Website activo - puntos por lo que les falta
      if (!ws.hasContactForm) score += 8;
      if (!ws.hasWhatsAppWidget) score += 8;
      if (!ws.hasLiveChat) score += 5;
      if (!ws.hasSslCertificate) score += 6;
      if (!ws.isMobileResponsive) score += 8;
      if (ws.loadTime && ws.loadTime > 4000) score += 5;
    }

    // Teléfono disponible (máx 10 pts) - Podemos contactarlos
    if (data.hasPhone) score += 10;

    return Math.min(score, 100);
  }

  private estimateRevenue(data: {
    reviewCount: number;
    googleRating?: number;
    category: string;
    location: string;
  }): "Low" | "Medium" | "High" {
    const locationLower = data.location.toLowerCase();
    const categoryLower = data.category.toLowerCase();

    // Zonas premium Argentina
    const premiumZones = [
      "nordelta",
      "puerto madero",
      "recoleta",
      "palermo",
      "san isidro",
      "vicente lopez",
      "martinez",
      "olivos",
      "belgrano",
      "nunez",
      "caballito",
      "villa crespo",
      "colegiales",
      "las cañitas",
    ];
    const isPremium = premiumZones.some((z) => locationLower.includes(z));

    // Categorías high-ticket
    const highTicket = [
      "clinic",
      "clínica",
      "estetica",
      "estética",
      "abogado",
      "lawyer",
      "automotor",
      "inmobiliaria",
      "real estate",
      "dentist",
      "odonto",
      "cirugía",
      "surgery",
      "medicina",
      "arquitect",
      "contad",
    ];
    const isHighTicket = highTicket.some((c) => categoryLower.includes(c));

    // Indicadores
    const hasHighReviews = data.reviewCount >= 50;
    const hasGoodRating = (data.googleRating || 0) >= 4.0;

    if (isPremium && hasHighReviews && hasGoodRating) return "High";
    if (isHighTicket && hasHighReviews) return "High";
    if ((isPremium || isHighTicket) && hasGoodRating) return "Medium";
    if (hasHighReviews) return "Medium";

    return "Low";
  }

  private identifyPainPoints(ws: WebsiteAnalysis, data: any): string[] {
    const points: string[] = [];

    if (!ws.hasWebsite) {
      points.push(
        "🔴 Sin presencia digital - perdiendo clientes que buscan online"
      );
    }
    if (ws.status === "parked") {
      points.push("🔴 Dominio expirado - daño a la marca y credibilidad");
    }
    if (ws.status === "generic") {
      points.push("🟠 Website incompleto - no genera confianza");
    }
    if (!ws.hasWhatsAppWidget && ws.hasWebsite) {
      points.push("🟠 Sin WhatsApp - respuestas lentas, leads perdidos");
    }
    if (!ws.hasContactForm && ws.hasWebsite) {
      points.push("🟠 Sin formulario - no captura datos de interesados");
    }
    if (!ws.hasLiveChat && ws.hasWebsite) {
      points.push("🟡 Sin chat - no atiende consultas inmediatas");
    }
    if (!ws.hasSslCertificate && ws.hasWebsite) {
      points.push('🔴 Sin SSL - Chrome marca como "No seguro"');
    }
    if (!ws.isMobileResponsive && ws.hasWebsite) {
      points.push("🟠 No mobile-friendly - 70% del tráfico es móvil");
    }
    if (data.reviewCount >= 50 && !ws.hasWebsite) {
      points.push("🔴 Alta demanda sin canal online - urgente");
    }

    return points;
  }

  private identifyOpportunities(ws: WebsiteAnalysis, data: any): string[] {
    const opps: string[] = [];

    if (!ws.hasWebsite) {
      opps.push("💰 Website profesional + SEO local");
      opps.push("💰 Sistema de reservas online");
    }
    if (!ws.hasWhatsAppWidget) {
      opps.push("💰 Bot de WhatsApp para consultas 24/7");
    }
    if (!ws.hasContactForm) {
      opps.push("💰 Landing page con lead magnet");
    }
    if (!ws.hasLiveChat) {
      opps.push("💰 Chatbot con IA para atención");
    }
    if (Object.keys(ws.socialMedia).length < 2) {
      opps.push("💰 Gestión de redes sociales");
    }
    if (data.reviewCount >= 30) {
      opps.push("💰 Gestión de reputación online");
    }
    if (!ws.isMobileResponsive && ws.hasWebsite) {
      opps.push("💰 Rediseño responsive");
    }

    return opps;
  }
}

export const enrichmentService = new EnrichmentService();
export default enrichmentService;
