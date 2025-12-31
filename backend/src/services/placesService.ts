import { PrismaClient } from "@prisma/client";
import enrichmentService, { WebsiteAnalysis } from "./enrichmentService";
import googleMapsScraper, { ScrapedPlace } from "./googleMapsScraper";
import logger from "./logger";
import { analyzeZone, ZoneAnalysis } from "./zoneService";

const prisma = new PrismaClient();

export interface Lead {
  // Datos básicos
  placeId: string;
  name: string;
  category: string;
  address: string;
  latitude?: number;
  longitude?: number;

  // Contacto
  phone?: string;
  website?: string;
  email?: string;

  // Métricas
  rating?: number;
  reviewCount: number;
  priceLevel?: string;

  // URLs
  googleMapsUrl: string;

  // Enriquecimiento
  hasContactForm?: boolean;
  hasWhatsApp?: boolean;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  sslEnabled?: boolean;

  // Nuevos campos de análisis
  hasRealWebsite: boolean; // true solo si tiene web real (no red social)
  socialMediaUrl?: string; // URL de red social
  relevanceScore: number; // Score de relevancia con la búsqueda
  leadScore: number; // Score calculado del lead

  // Control
  enriched: boolean;
  scrapedAt: Date;
}

export interface SearchOptions {
  keyword: string;
  location: string;
  maxResults?: number;
  enrich?: boolean;
  minRating?: number;
  requirePhone?: boolean;
  requireWebsite?: boolean;
  minRelevance?: number; // Filtrar por relevancia mínima
  excludeExisting?: boolean; // Excluir leads que ya existen en DB
}

export interface SearchResult {
  success: boolean;
  leads: Lead[];
  stats: {
    total: number;
    withPhone: number;
    withWebsite: number;
    withEmail: number;
    avgRating: number;
    enriched: number;
    // Nuevas estadísticas anti-duplicados
    newLeads: number;
    existingLeads: number;
    duplicatePercentage: number;
  };
  timing: {
    scraping: number;
    enrichment: number;
    total: number;
  };
  // Info de saturación de zona
  zoneSaturation?: {
    isExhausted: boolean;
    message: string;
    suggestion?: string;
  };
  // Info de búsqueda por zonas
  zoneInfo?: {
    isLargeZone: boolean;
    originalLocation: string;
    subzonesSearched: number;
    subzones: string[];
  };
}

class PlacesService {
  /**
   * Obtener placeIds que ya existen en la base de datos
   */
  private async getExistingPlaceIds(): Promise<Set<string>> {
    const existing = await prisma.lead.findMany({
      select: { placeId: true },
    });
    return new Set(existing.map((l) => l.placeId));
  }

  /**
   * Buscar negocios y convertir a leads
   * Si detecta una zona grande, automáticamente subdivide la búsqueda
   */
  async searchPlaces(options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      keyword,
      location,
      maxResults = 30,
      enrich = true,
      minRating,
      requirePhone,
      requireWebsite,
      excludeExisting = true,
    } = options;

    // 🗺️ Analizar si es una zona grande
    const zoneAnalysis = analyzeZone(location);

    if (zoneAnalysis.isLargeZone) {
      logger.info(
        `🗺️ Zona grande detectada: "${location}" → ${zoneAnalysis.subzones.length} sub-zonas`
      );
      return this.searchMultipleZones(options, zoneAnalysis);
    }

    // Búsqueda normal para zonas pequeñas
    return this.searchSingleZone(options);
  }

  /**
   * Buscar en múltiples sub-zonas (para zonas grandes)
   */
  private async searchMultipleZones(
    options: SearchOptions,
    zoneAnalysis: ZoneAnalysis
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      keyword,
      maxResults = 30,
      enrich = true,
      minRating,
      requirePhone,
      requireWebsite,
      excludeExisting = true,
    } = options;

    const existingPlaceIds = await this.getExistingPlaceIds();
    logger.info(
      `📊 ${existingPlaceIds.size} leads ya existen en la base de datos`
    );

    let allLeads: Lead[] = [];
    let totalScrapingTime = 0;
    let totalEnrichmentTime = 0;
    const seenPlaceIds = new Set<string>();

    // Buscar en cada sub-zona
    for (let i = 0; i < zoneAnalysis.subzones.length; i++) {
      const subzone = zoneAnalysis.subzones[i];
      logger.info(
        `🗺️ [${i + 1}/${zoneAnalysis.subzones.length}] Buscando en: ${subzone}`
      );

      try {
        const scrapeStart = Date.now();
        const scrapedPlaces = await googleMapsScraper.scrapePlaces({
          keyword,
          location: subzone,
          maxResults: Math.ceil(maxResults / zoneAnalysis.subzones.length) + 10,
        });
        totalScrapingTime += Date.now() - scrapeStart;

        // Convertir y filtrar duplicados dentro de esta búsqueda
        for (const place of scrapedPlaces) {
          if (!seenPlaceIds.has(place.placeId)) {
            seenPlaceIds.add(place.placeId);
            allLeads.push(this.toLead(place));
          }
        }

        logger.info(
          `   ✓ ${scrapedPlaces.length} encontrados, ${allLeads.length} total acumulado`
        );

        // Delay entre sub-zonas para evitar rate limiting
        if (i < zoneAnalysis.subzones.length - 1) {
          await this.delay(2000 + Math.random() * 2000);
        }
      } catch (error) {
        logger.warn(
          `   ⚠️ Error en sub-zona ${subzone}: ${(error as Error).message}`
        );
        // Continuar con la siguiente sub-zona
      }
    }

    logger.info(
      `🗺️ Búsqueda multi-zona completada: ${allLeads.length} leads de ${zoneAnalysis.subzones.length} sub-zonas`
    );

    // Separar nuevos de existentes
    const newLeads: Lead[] = [];
    const existingLeadsArr: Lead[] = [];

    for (const lead of allLeads) {
      if (existingPlaceIds.has(lead.placeId)) {
        existingLeadsArr.push(lead);
      } else {
        newLeads.push(lead);
      }
    }

    logger.info(
      `🆕 ${newLeads.length} leads nuevos | 🔄 ${existingLeadsArr.length} ya existentes`
    );

    // Decidir qué leads usar
    let leads = excludeExisting ? newLeads : [...newLeads, ...existingLeadsArr];

    // Filtrar por relevancia
    const minRelevanceScore = 20;
    leads = leads.filter((l) => l.relevanceScore >= minRelevanceScore);

    // Filtros adicionales
    if (minRating) leads = leads.filter((l) => (l.rating || 0) >= minRating);
    if (requirePhone) leads = leads.filter((l) => l.phone);
    if (requireWebsite) leads = leads.filter((l) => l.website);

    // Ordenar y limitar
    leads.sort((a, b) => b.leadScore - a.leadScore);
    leads = leads.slice(0, maxResults);

    // Enriquecer
    if (enrich && leads.length > 0) {
      const enrichStart = Date.now();
      leads = await this.enrichLeads(leads.slice(0, 20)); // Max 20 para no tardar mucho
      totalEnrichmentTime = Date.now() - enrichStart;
    }

    // Calcular stats de zona agotada
    const duplicatePercentage =
      allLeads.length > 0
        ? Math.round((existingLeadsArr.length / allLeads.length) * 100)
        : 0;

    const isZoneExhausted = duplicatePercentage >= 80;

    return {
      success: true,
      leads,
      stats: {
        total: allLeads.length,
        withPhone: leads.filter((l) => l.phone).length,
        withWebsite: leads.filter((l) => l.website).length,
        withEmail: leads.filter((l) => l.email).length,
        avgRating:
          leads.length > 0
            ? Math.round(
                (leads.reduce((sum, l) => sum + (l.rating || 0), 0) /
                  leads.length) *
                  10
              ) / 10
            : 0,
        enriched: leads.filter((l) => l.enriched).length,
        newLeads: newLeads.length,
        existingLeads: existingLeadsArr.length,
        duplicatePercentage,
      },
      timing: {
        scraping: totalScrapingTime,
        enrichment: totalEnrichmentTime,
        total: Date.now() - startTime,
      },
      zoneSaturation: isZoneExhausted
        ? {
            isExhausted: true,
            message: `${duplicatePercentage}% de resultados ya existían`,
            suggestion: "Probá con keywords más específicas o diferente zona",
          }
        : undefined,
      zoneInfo: {
        isLargeZone: true,
        originalLocation: zoneAnalysis.originalLocation,
        subzonesSearched: zoneAnalysis.subzones.length,
        subzones: zoneAnalysis.subzones,
      },
    };
  }

  /**
   * Búsqueda en una sola zona (comportamiento original)
   */
  private async searchSingleZone(
    options: SearchOptions
  ): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      keyword,
      location,
      maxResults = 30,
      enrich = true,
      minRating,
      requirePhone,
      requireWebsite,
      excludeExisting = true,
    } = options;

    logger.info(`🔍 Iniciando búsqueda: "${keyword}" en "${location}"`);

    let scrapingTime = 0;
    let enrichmentTime = 0;

    try {
      const existingPlaceIds = await this.getExistingPlaceIds();
      logger.info(
        `📊 ${existingPlaceIds.size} leads ya existen en la base de datos`
      );

      const scrapeStart = Date.now();
      const scrapedPlaces = await googleMapsScraper.scrapePlaces({
        keyword,
        location,
        maxResults: maxResults + 50,
      });
      scrapingTime = Date.now() - scrapeStart;

      logger.info(
        `📍 Scrapeados ${scrapedPlaces.length} lugares en ${scrapingTime}ms`
      );

      let leads: Lead[] = scrapedPlaces.map((place) => this.toLead(place));

      // Separar nuevos de existentes
      const allLeadsCount = leads.length;
      const newLeads: Lead[] = [];
      const existingLeads: Lead[] = [];

      for (const lead of leads) {
        if (existingPlaceIds.has(lead.placeId)) {
          existingLeads.push(lead);
        } else {
          newLeads.push(lead);
        }
      }

      logger.info(
        `🆕 ${newLeads.length} leads nuevos | 🔄 ${existingLeads.length} ya existentes`
      );

      // 4. Decidir qué leads usar según excludeExisting
      leads = excludeExisting ? newLeads : [...newLeads, ...existingLeads];

      // 5. Filtrar por relevancia (mínimo 20 para excluir no relacionados)
      const minRelevanceScore = 20;
      const beforeRelevance = leads.length;
      leads = leads.filter((l) => l.relevanceScore >= minRelevanceScore);

      if (beforeRelevance > leads.length) {
        logger.info(
          `🎯 Filtrado por relevancia: ${beforeRelevance} → ${
            leads.length
          } (excluidos ${beforeRelevance - leads.length} no relacionados)`
        );
      }

      // 4. Filtrar por criterios adicionales
      if (minRating) {
        leads = leads.filter((l) => (l.rating || 0) >= minRating);
      }
      if (requirePhone) {
        leads = leads.filter((l) => l.phone);
      }
      if (requireWebsite) {
        leads = leads.filter((l) => l.website);
      }

      // 5. Ordenar por leadScore (mejores primero)
      leads.sort((a, b) => b.leadScore - a.leadScore);

      // 6. Limitar al máximo solicitado
      leads = leads.slice(0, maxResults);

      logger.info(`🎯 ${leads.length} leads después de filtros`);

      // 7. Enriquecer (opcional)
      if (enrich && leads.length > 0) {
        const enrichStart = Date.now();
        leads = await this.enrichLeads(leads);
        enrichmentTime = Date.now() - enrichStart;
        logger.info(`✨ Enriquecimiento completado en ${enrichmentTime}ms`);
      }

      // 8. Guardar en base de datos (solo los nuevos)
      const savedCount = await this.saveLeadsToDatabase(
        leads,
        keyword,
        location
      );
      logger.info(`💾 ${savedCount} leads guardados en la base de datos`);

      // 9. Calcular estadísticas con info de duplicados
      const baseStats = this.calculateStats(leads);
      const duplicatePercentage =
        allLeadsCount > 0
          ? Math.round((existingLeads.length / allLeadsCount) * 100)
          : 0;

      const stats = {
        ...baseStats,
        newLeads: newLeads.length,
        existingLeads: existingLeads.length,
        duplicatePercentage,
      };

      // 10. Detectar zona agotada
      let zoneSaturation: SearchResult["zoneSaturation"] = undefined;

      if (duplicatePercentage >= 80 && existingLeads.length > 10) {
        zoneSaturation = {
          isExhausted: true,
          message: `⚠️ El ${duplicatePercentage}% de los resultados ya existían en tu base de datos.`,
          suggestion: `Posiblemente hayas cubierto la mayoría de "${keyword}" en "${location}". Prueba con otra zona o keyword.`,
        };
        logger.warn(
          `🏁 Zona posiblemente agotada: ${duplicatePercentage}% duplicados`
        );
      } else if (duplicatePercentage >= 50) {
        zoneSaturation = {
          isExhausted: false,
          message: `ℹ️ El ${duplicatePercentage}% de los resultados ya existían.`,
          suggestion: `Aún hay leads nuevos por encontrar en esta zona.`,
        };
      }

      // 11. Si no hay leads nuevos, mensaje especial
      if (leads.length === 0 && existingLeads.length > 0) {
        zoneSaturation = {
          isExhausted: true,
          message: `✅ Ya tienes todos los "${keyword}" de "${location}" en tu base de datos.`,
          suggestion: `Busca en otra zona o con otra keyword para encontrar más leads.`,
        };
      }

      const result: SearchResult = {
        success: true,
        leads,
        stats,
        timing: {
          scraping: scrapingTime,
          enrichment: enrichmentTime,
          total: Date.now() - startTime,
        },
        zoneSaturation,
      };

      logger.info(
        `✅ Búsqueda completada: ${leads.length} leads nuevos (${existingLeads.length} omitidos) en ${result.timing.total}ms`
      );

      return result;
    } catch (error: any) {
      logger.error(`❌ Error en búsqueda: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delay helper para esperas entre requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convertir ScrapedPlace a Lead con cálculo de leadScore
   */
  private toLead(place: ScrapedPlace): Lead {
    // Calcular leadScore basado en múltiples factores
    let leadScore = 0;

    // SIN WEB REAL = Oportunidad máxima (+35 puntos)
    if (!place.hasRealWebsite) {
      leadScore += 35;
    }

    // Solo tiene red social = Oportunidad alta (+20 puntos)
    if (place.socialMediaUrl && !place.hasRealWebsite) {
      leadScore += 20;
    }

    // Tiene teléfono = Contactable (+15 puntos)
    if (place.phone) {
      leadScore += 15;
    }

    // Rating alto (>4.0) = Negocio establecido (+10 puntos)
    if (place.rating && place.rating >= 4.0) {
      leadScore += 10;
    }

    // Muchas reviews = Popular (+10 puntos si >50, +5 si >20)
    if (place.reviewCount >= 50) {
      leadScore += 10;
    } else if (place.reviewCount >= 20) {
      leadScore += 5;
    }

    // Relevancia con la búsqueda (+10 si es muy relevante)
    if (place.relevanceScore >= 80) {
      leadScore += 10;
    } else if (place.relevanceScore >= 40) {
      leadScore += 5;
    }

    // Cap en 100
    leadScore = Math.min(100, leadScore);

    return {
      placeId: place.placeId,
      name: place.name,
      category: place.category,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      phone: place.phone,
      website: place.website,
      rating: place.rating,
      reviewCount: place.reviewCount,
      priceLevel: place.priceLevel,
      googleMapsUrl: place.googleMapsUrl,
      hasRealWebsite: place.hasRealWebsite,
      socialMediaUrl: place.socialMediaUrl,
      relevanceScore: place.relevanceScore,
      leadScore,
      enriched: false,
      scrapedAt: new Date(),
    };
  }

  /**
   * Enriquecer leads con datos del website
   */
  private async enrichLeads(leads: Lead[]): Promise<Lead[]> {
    const enriched: Lead[] = [];

    for (const lead of leads) {
      if (!lead.website) {
        enriched.push(lead);
        continue;
      }

      try {
        const data = await enrichmentService.analyzeWebsite(lead.website);
        enriched.push(this.mergeEnrichment(lead, data));
      } catch (error: any) {
        logger.debug(`⚠️ Error enriqueciendo ${lead.name}: ${error.message}`);
        enriched.push(lead);
      }
    }

    return enriched;
  }

  /**
   * Combinar lead con datos de enriquecimiento
   */
  private mergeEnrichment(lead: Lead, data: WebsiteAnalysis): Lead {
    return {
      ...lead,
      email: data.emails[0] || lead.email,
      hasContactForm: data.hasContactForm,
      hasWhatsApp: data.hasWhatsAppWidget,
      socialMedia: {
        facebook: data.socialMedia.facebook,
        instagram: data.socialMedia.instagram,
        twitter: data.socialMedia.twitter,
        linkedin: data.socialMedia.linkedin,
      },
      sslEnabled: data.hasSslCertificate,
      enriched: true,
    };
  }

  /**
   * Calcular estadísticas de los leads
   */
  private calculateStats(leads: Lead[]) {
    const withPhone = leads.filter((l) => l.phone).length;
    const withWebsite = leads.filter((l) => l.website).length;
    const withEmail = leads.filter((l) => l.email).length;
    const ratings = leads.filter((l) => l.rating).map((l) => l.rating!);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
    const enrichedCount = leads.filter((l) => l.enriched).length;

    return {
      total: leads.length,
      withPhone,
      withWebsite,
      withEmail,
      avgRating: Math.round(avgRating * 10) / 10,
      enriched: enrichedCount,
    };
  }

  /**
   * Guardar leads en la base de datos
   */
  private async saveLeadsToDatabase(
    leads: Lead[],
    keyword: string,
    location: string
  ): Promise<number> {
    let savedCount = 0;

    for (const lead of leads) {
      try {
        await prisma.lead.upsert({
          where: { placeId: lead.placeId },
          update: {
            businessName: lead.name,
            category: lead.category,
            address: lead.address,
            latitude: lead.latitude ?? 0,
            longitude: lead.longitude ?? 0,
            phoneRaw: lead.phone ?? null,
            googleRating: lead.rating ?? null,
            reviewCount: lead.reviewCount,
            hasWebsite: lead.hasRealWebsite,
            websiteUrl: lead.website ?? null,
            googleMapsUrl: lead.googleMapsUrl,
            emails: lead.email ? [lead.email] : [],
            hasContactForm: lead.hasContactForm ?? false,
            hasWhatsAppWidget: lead.hasWhatsApp ?? false,
            hasSslCertificate: lead.sslEnabled ?? false,
            facebookUrl:
              lead.socialMedia?.facebook ?? lead.socialMediaUrl ?? null,
            instagramUrl:
              lead.socialMedia?.instagram ??
              (lead.socialMediaUrl?.includes("instagram")
                ? lead.socialMediaUrl
                : null),
            twitterUrl: lead.socialMedia?.twitter ?? null,
            linkedinUrl: lead.socialMedia?.linkedin ?? null,
            leadScore: lead.leadScore,
            updatedAt: new Date(),
          },
          create: {
            placeId: lead.placeId,
            businessName: lead.name,
            category: lead.category,
            address: lead.address,
            latitude: lead.latitude ?? 0,
            longitude: lead.longitude ?? 0,
            phoneRaw: lead.phone ?? null,
            googleRating: lead.rating ?? null,
            reviewCount: lead.reviewCount,
            hasWebsite: lead.hasRealWebsite,
            websiteUrl: lead.website ?? null,
            googleMapsUrl: lead.googleMapsUrl,
            emails: lead.email ? [lead.email] : [],
            hasContactForm: lead.hasContactForm ?? false,
            hasWhatsAppWidget: lead.hasWhatsApp ?? false,
            hasSslCertificate: lead.sslEnabled ?? false,
            facebookUrl:
              lead.socialMedia?.facebook ?? lead.socialMediaUrl ?? null,
            instagramUrl:
              lead.socialMedia?.instagram ??
              (lead.socialMediaUrl?.includes("instagram")
                ? lead.socialMediaUrl
                : null),
            twitterUrl: lead.socialMedia?.twitter ?? null,
            linkedinUrl: lead.socialMedia?.linkedin ?? null,
            leadScore: lead.leadScore,
            searchKeyword: keyword,
            searchLocation: location,
          },
        });
        savedCount++;
      } catch (error: any) {
        logger.error(`❌ Error guardando lead ${lead.name}: ${error.message}`);
      }
    }

    // Registrar en historial de búsquedas
    try {
      await prisma.searchHistory.create({
        data: {
          keyword,
          location,
          radius: 5000,
          resultsFound: leads.length,
          leadsCreated: savedCount,
        },
      });
    } catch (error: any) {
      logger.debug(`⚠️ Error guardando historial: ${error.message}`);
    }

    return savedCount;
  }

  /**
   * Cerrar recursos (navegador)
   */
  async shutdown(): Promise<void> {
    await googleMapsScraper.close();
    await prisma.$disconnect();
  }
}

export const placesService = new PlacesService();
export default placesService;
