import { PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import path from "path";

// Cargar .env
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config();

import { z } from "zod";
import browserPool from "./services/browserPool";
import cacheService from "./services/cacheService";
import crmExportService from "./services/crmExportService";
import logger from "./services/logger";
import placesService from "./services/placesService";
import premiumAlertService from "./services/premiumAlertService";
import techStackDetector from "./services/techStackDetector";

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Demasiadas solicitudes, intenta en un minuto" },
});
app.use("/api/", limiter);

// Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/health") {
      logger.debug(
        `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

// ==================== VALIDACIONES ====================

const searchSchema = z.object({
  keyword: z.string().min(1, "Keyword es requerido").max(100),
  location: z.string().min(1, "Location es requerido").max(100),
  maxResults: z.number().min(1).max(100).optional().default(30),
  enrich: z.boolean().optional().default(true),
  minRating: z.number().min(0).max(5).optional(),
  requirePhone: z.boolean().optional(),
  requireWebsite: z.boolean().optional(),
  excludeExisting: z.boolean().optional().default(true), // Excluir duplicados
});

// Campos válidos para ordenamiento
const VALID_SORT_FIELDS = [
  "leadScore",
  "googleRating",
  "reviewCount",
  "createdAt",
  "businessName",
] as const;

type SortField = (typeof VALID_SORT_FIELDS)[number];

// ==================== ENDPOINTS ====================

/**
 * 🏥 Health check
 */
app.get("/health", async (req: Request, res: Response) => {
  const cacheStats = await cacheService.getStats();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "3.0.0 - Puppeteer Edition",
    mode: "FREE (No API key required)",
    cache: cacheStats,
  });
});

/**
 * 🚀 Iniciar scraping (versión normal - sin streaming)
 */
app.post("/api/scrape", async (req: Request, res: Response) => {
  try {
    const validated = searchSchema.parse(req.body);

    logger.info(
      `🎯 Nueva búsqueda: "${validated.keyword}" en ${validated.location} (excludeExisting: ${validated.excludeExisting})`
    );

    const result = await placesService.searchPlaces(validated);

    // Obtener los leads recién guardados desde la DB
    const savedLeads = await prisma.lead.findMany({
      where: {
        searchKeyword: validated.keyword,
        searchLocation: validated.location,
      },
      orderBy: { leadScore: "desc" },
      take: validated.maxResults || 30,
    });

    // Recalcular scores si están en 0
    const leadsWithScores = savedLeads.map((lead) => {
      if (lead.leadScore === 0) {
        return {
          ...lead,
          leadScore: calculateLeadScore(lead),
        };
      }
      return lead;
    });

    res.json({
      message: result.zoneInfo?.isLargeZone
        ? `Búsqueda multi-zona: ${result.stats.newLeads} leads nuevos de ${result.zoneInfo.subzonesSearched} sub-zonas`
        : `Se encontraron ${result.stats.newLeads} leads nuevos`,
      success: true,
      leads: leadsWithScores,
      stats: {
        found: result.stats.total,
        newLeads: result.stats.newLeads,
        existingLeads: result.stats.existingLeads,
        duplicatePercentage: result.stats.duplicatePercentage,
        saved: savedLeads.length,
        duration: result.timing.total,
        estimatedCost: 0,
      },
      zoneSaturation: result.zoneSaturation,
      zoneInfo: result.zoneInfo,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`❌ Error en scraping: ${err.message}`);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      error: "Error en el servidor",
      message: err.message,
    });
  }
});

/**
 * 🔄 Scraping con streaming (Server-Sent Events)
 * Los leads se envían en tiempo real conforme se encuentran
 */
app.get("/api/scrape/stream", async (req: Request, res: Response) => {
  // Configurar SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Helper para enviar eventos
  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const keyword = req.query.keyword as string;
    const location = req.query.location as string;
    const maxResults = parseInt(req.query.maxResults as string) || 30;
    const strictMatch = req.query.strictMatch === "true"; // 🆕 Modo estricto

    if (!keyword || !location) {
      sendEvent("error", { message: "keyword y location son requeridos" });
      res.end();
      return;
    }

    logger.info(
      `🎯 [STREAM] Búsqueda: "${keyword}" en ${location}${
        strictMatch ? " (modo estricto)" : ""
      }`
    );
    sendEvent("start", { keyword, location, maxResults, strictMatch });

    // Importar y usar el scraper directamente para tener control granular
    const googleMapsScraper = (await import("./services/googleMapsScraper"))
      .default;
    const { analyzeZone } = await import("./services/zoneService");

    const zoneAnalysis = analyzeZone(location);
    const zones = zoneAnalysis.subzones;
    const seenPlaceIds = new Set<string>();
    let totalFound = 0;

    // Obtener placeIds existentes
    const existingLeads = await prisma.lead.findMany({
      select: { placeId: true },
    });
    const existingPlaceIds = new Set(existingLeads.map((l) => l.placeId));

    sendEvent("zones", {
      isLargeZone: zoneAnalysis.isLargeZone,
      totalZones: zones.length,
      zones: zones,
    });

    // Scrapear cada zona
    for (let i = 0; i < zones.length && totalFound < maxResults; i++) {
      const zone = zones[i];
      sendEvent("zone_start", { zone, index: i + 1, total: zones.length });

      try {
        const places = await googleMapsScraper.scrapePlaces({
          keyword,
          location: zone,
          maxResults: Math.ceil(maxResults / zones.length) + 5,
          strictMatch, // 🆕 Pasar modo estricto al scraper
        });

        for (const place of places) {
          // Skip duplicados
          if (
            seenPlaceIds.has(place.placeId) ||
            existingPlaceIds.has(place.placeId)
          ) {
            continue;
          }
          seenPlaceIds.add(place.placeId);

          // Calcular leadScore
          let leadScore = 0;
          if (!place.hasRealWebsite) leadScore += 35;
          if (place.socialMediaUrl) leadScore += 20;
          if (place.rating && place.rating >= 4.0) leadScore += 15;
          if (place.reviewCount >= 50) leadScore += 10;
          if (place.phone) leadScore += 10;

          // Guardar en DB
          const savedLead = await prisma.lead.upsert({
            where: { placeId: place.placeId },
            update: {},
            create: {
              placeId: place.placeId,
              businessName: place.name,
              category: place.category || "Sin categoría",
              address: place.address,
              latitude: 0,
              longitude: 0,
              phoneRaw: place.phone,
              websiteUrl: place.website,
              googleMapsUrl: place.googleMapsUrl,
              googleRating: place.rating,
              reviewCount: place.reviewCount,
              hasWebsite: place.hasRealWebsite,
              instagramUrl: place.socialMediaUrl?.includes("instagram")
                ? place.socialMediaUrl
                : undefined,
              facebookUrl: place.socialMediaUrl?.includes("facebook")
                ? place.socialMediaUrl
                : undefined,
              leadScore,
              searchKeyword: keyword,
              searchLocation: location,
              outreachStatus: "new",
            },
          });

          totalFound++;
          sendEvent("lead", {
            lead: savedLead,
            count: totalFound,
            maxResults,
          });

          // Evaluar si es lead premium y enviar alerta
          const premiumAlert = premiumAlertService.evaluateLead({
            id: savedLead.id,
            businessName: savedLead.businessName,
            category: savedLead.category,
            address: savedLead.address,
            googleRating: savedLead.googleRating,
            reviewCount: savedLead.reviewCount,
            hasWebsite: savedLead.hasWebsite,
            websiteUrl: savedLead.websiteUrl,
            leadScore: savedLead.leadScore,
            phoneRaw: savedLead.phoneRaw,
            instagramUrl: savedLead.instagramUrl,
            facebookUrl: savedLead.facebookUrl,
          });

          if (premiumAlert) {
            sendEvent("premium_alert", premiumAlert);
          }

          if (totalFound >= maxResults) break;
        }

        sendEvent("zone_complete", {
          zone,
          index: i + 1,
          found: places.length,
          totalFound,
        });

        // Delay entre zonas
        if (i < zones.length - 1 && totalFound < maxResults) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (zoneError) {
        sendEvent("zone_error", {
          zone,
          error: (zoneError as Error).message,
        });
      }
    }

    sendEvent("complete", {
      totalFound,
      duration: Date.now(),
    });

    res.end();
  } catch (error) {
    sendEvent("error", { message: (error as Error).message });
    res.end();
  }
});

/**
 * Calcular leadScore para un lead de la base de datos
 */
function calculateLeadScore(lead: any): number {
  let score = 0;

  // SIN WEB REAL = Oportunidad máxima (+35 puntos)
  if (!lead.hasWebsite) {
    score += 35;
  }

  // Solo tiene red social = Oportunidad alta (+20 puntos)
  if ((lead.instagramUrl || lead.facebookUrl) && !lead.hasWebsite) {
    score += 20;
  }

  // Tiene teléfono = Contactable (+15 puntos)
  if (lead.phoneRaw) {
    score += 15;
  }

  // Rating alto (>4.0) = Negocio establecido (+10 puntos)
  if (lead.googleRating && lead.googleRating >= 4.0) {
    score += 10;
  }

  // Muchas reviews = Popular (+10 puntos si >50, +5 si >20)
  if (lead.reviewCount >= 50) {
    score += 10;
  } else if (lead.reviewCount >= 20) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * 📋 Obtener leads con paginación y ordenamiento
 */
app.get("/api/leads", async (req: Request, res: Response) => {
  try {
    // Parámetros de paginación
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50)
    );
    const offset = (page - 1) * limit;

    // Parámetros de ordenamiento
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder =
      (req.query.sortOrder as string) === "asc" ? "asc" : "desc";

    // Validar campo de ordenamiento
    const validSortField = VALID_SORT_FIELDS.includes(sortBy as SortField)
      ? sortBy
      : "createdAt";

    // Filtros opcionales
    const filterNoWebsite = req.query.noWebsite === "true";
    const filterMinScore = parseInt(req.query.minScore as string) || 0;
    const filterStatus = req.query.status as string;
    const searchQuery = req.query.search as string;

    // Construir where clause
    const where: any = {};

    if (filterNoWebsite) {
      where.hasWebsite = false;
    }
    if (filterMinScore > 0) {
      where.leadScore = { gte: filterMinScore };
    }
    if (filterStatus && filterStatus !== "all") {
      where.outreachStatus = filterStatus;
    }
    if (searchQuery) {
      where.OR = [
        { businessName: { contains: searchQuery, mode: "insensitive" } },
        { category: { contains: searchQuery, mode: "insensitive" } },
        { address: { contains: searchQuery, mode: "insensitive" } },
        { phoneRaw: { contains: searchQuery } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [validSortField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.lead.count({ where }),
    ]);

    // Recalcular scores si están en 0
    const leadsWithScores = leads.map((lead) => {
      if (lead.leadScore === 0) {
        return {
          ...lead,
          leadScore: calculateLeadScore(lead),
        };
      }
      return lead;
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      leads: leadsWithScores,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      sorting: {
        sortBy: validSortField,
        sortOrder,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error obteniendo leads: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔄 Recalcular todos los leadScores en la base de datos
 */
app.post(
  "/api/leads/recalculate-scores",
  async (req: Request, res: Response) => {
    try {
      const leads = await prisma.lead.findMany();
      let updated = 0;

      for (const lead of leads) {
        const newScore = calculateLeadScore(lead);
        if (lead.leadScore !== newScore) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { leadScore: newScore },
          });
          updated++;
        }
      }

      logger.info(`🔄 Recalculados ${updated} lead scores`);
      res.json({ message: `Recalculados ${updated} de ${leads.length} leads` });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Error recalculando scores: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * 📊 Estadísticas
 */
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    // Obtener estadísticas reales de la base de datos
    const [
      total,
      noWebsite,
      highScore,
      allLeads,
      recentSearches,
      statusCounts,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { hasWebsite: false } }),
      prisma.lead.count({ where: { leadScore: { gte: 70 } } }),
      prisma.lead.findMany({ select: { leadScore: true } }),
      prisma.searchHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.lead.groupBy({
        by: ["outreachStatus"],
        _count: true,
      }),
    ]);

    const avgScore =
      allLeads.length > 0
        ? Math.round(
            allLeads.reduce((sum, l) => sum + l.leadScore, 0) / allLeads.length
          )
        : 0;

    const byStatus: Record<string, number> = {};
    statusCounts.forEach((s) => {
      byStatus[s.outreachStatus] = s._count;
    });

    res.json({
      total,
      noWebsite,
      highScore,
      avgScore,
      byStatus,
      recentSearches: recentSearches.map((s) => ({
        id: s.id,
        keyword: s.keyword,
        location: s.location,
        results: s.resultsFound,
        cost: "$0.00",
        date: s.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error obteniendo stats: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🗑️ Limpiar caché
 */
app.delete("/api/cache", async (req: Request, res: Response) => {
  try {
    await cacheService.clear();
    logger.info("🗑️ Caché limpiado");
    res.json({ message: "Caché limpiado correctamente" });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

/**
 * 📤 Exportar leads a CSV
 */
app.get("/api/export", async (req: Request, res: Response) => {
  try {
    const minScore = parseInt(req.query.minScore as string) || 0;

    const leads = await prisma.lead.findMany({
      where: {
        leadScore: { gte: minScore },
      },
      orderBy: { createdAt: "desc" },
    });

    // Crear CSV
    const headers = [
      "Nombre",
      "Categoría",
      "Dirección",
      "Teléfono",
      "Email",
      "Website",
      "Rating",
      "Reviews",
      "Score",
      "Estado",
      "Google Maps",
    ];

    const rows = leads.map((lead) => [
      lead.businessName,
      lead.category,
      lead.address,
      lead.phoneRaw || "",
      lead.emails.join("; "),
      lead.websiteUrl || "",
      lead.googleRating?.toString() || "",
      lead.reviewCount.toString(),
      lead.leadScore.toString(),
      lead.outreachStatus,
      lead.googleMapsUrl || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads-${new Date().toISOString().split("T")[0]}.csv`
    );
    res.send("\uFEFF" + csv); // BOM para Excel
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error exportando: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔄 Actualizar estado de un lead
 */
app.patch("/api/leads/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { outreachStatus, notes, tags } = req.body;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(outreachStatus && { outreachStatus }),
        ...(notes !== undefined && { notes }),
        ...(tags && { tags }),
        ...(outreachStatus === "contacted" && { lastContactAt: new Date() }),
      },
    });

    res.json(lead);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error actualizando lead: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🗑️ Eliminar un lead
 */
app.delete("/api/leads/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.lead.delete({
      where: { id },
    });

    res.json({ message: "Lead eliminado" });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error eliminando lead: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🧹 Limpiar TODOS los leads (para empezar de cero)
 */
app.delete("/api/leads", async (req: Request, res: Response) => {
  try {
    const result = await prisma.lead.deleteMany({});

    logger.info(`🧹 Se eliminaron ${result.count} leads`);

    res.json({
      success: true,
      message: `Se eliminaron ${result.count} leads`,
      deletedCount: result.count,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error limpiando leads: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ==================== NUEVAS FUNCIONALIDADES ====================

/**
 * 🔍 Detectar stack tecnológico de un website
 */
app.get("/api/tech-stack", async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;

    if (!url) {
      return res.status(400).json({ error: "URL es requerida" });
    }

    const stack = await techStackDetector.detect(url);

    if (!stack) {
      return res.status(404).json({ error: "No se pudo analizar el sitio" });
    }

    res.json({
      url,
      stack,
      summary: techStackDetector.summarize(stack),
      opportunities: techStackDetector.identifyOpportunities(stack),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error detectando stack: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔍 Analizar tech stack de un lead específico
 */
app.post(
  "/api/leads/:id/analyze-stack",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const lead = await prisma.lead.findUnique({ where: { id } });

      if (!lead) {
        return res.status(404).json({ error: "Lead no encontrado" });
      }

      if (!lead.websiteUrl) {
        return res.status(400).json({ error: "El lead no tiene website" });
      }

      const stack = await techStackDetector.detect(lead.websiteUrl);

      if (stack) {
        // Guardar el stack en el lead
        await prisma.lead.update({
          where: { id },
          data: { techStack: techStackDetector.summarize(stack) },
        });
      }

      res.json({
        leadId: id,
        businessName: lead.businessName,
        websiteUrl: lead.websiteUrl,
        stack,
        summary: stack ? techStackDetector.summarize(stack) : null,
        opportunities: stack
          ? techStackDetector.identifyOpportunities(stack)
          : [],
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Error analizando stack del lead: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }
);

/**
 * 🔔 Obtener alertas premium recientes
 */
app.get("/api/alerts/premium", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const alerts = premiumAlertService.getRecentAlerts(limit);
    const stats = premiumAlertService.getAlertStats();

    res.json({
      alerts,
      stats,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error obteniendo alertas: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔔 Stream de alertas premium (SSE)
 */
app.get("/api/alerts/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const unsubscribe = premiumAlertService.onAlert((alert) => {
    res.write(`event: alert\n`);
    res.write(`data: ${JSON.stringify(alert)}\n\n`);
  });

  req.on("close", () => {
    unsubscribe();
  });
});

/**
 * 📤 Exportar a Notion
 */
app.post("/api/export/notion", async (req: Request, res: Response) => {
  try {
    const { apiKey, databaseId, leadIds, minScore } = req.body;

    if (!apiKey || !databaseId) {
      return res
        .status(400)
        .json({ error: "apiKey y databaseId son requeridos" });
    }

    // Obtener leads a exportar
    const where: any = {};
    if (leadIds && leadIds.length > 0) {
      where.id = { in: leadIds };
    }
    if (minScore) {
      where.leadScore = { gte: minScore };
    }

    const leads = await prisma.lead.findMany({ where });

    if (leads.length === 0) {
      return res.status(400).json({ error: "No hay leads para exportar" });
    }

    const result = await crmExportService.exportToNotion(leads, {
      apiKey,
      databaseId,
    });

    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error exportando a Notion: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 📤 Exportar a Airtable
 */
app.post("/api/export/airtable", async (req: Request, res: Response) => {
  try {
    const { apiKey, baseId, tableName, leadIds, minScore } = req.body;

    if (!apiKey || !baseId || !tableName) {
      return res
        .status(400)
        .json({ error: "apiKey, baseId y tableName son requeridos" });
    }

    // Obtener leads a exportar
    const where: any = {};
    if (leadIds && leadIds.length > 0) {
      where.id = { in: leadIds };
    }
    if (minScore) {
      where.leadScore = { gte: minScore };
    }

    const leads = await prisma.lead.findMany({ where });

    if (leads.length === 0) {
      return res.status(400).json({ error: "No hay leads para exportar" });
    }

    const result = await crmExportService.exportToAirtable(leads, {
      apiKey,
      baseId,
      tableName,
    });

    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error exportando a Airtable: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔗 Verificar conexión a Notion
 */
app.post("/api/export/notion/test", async (req: Request, res: Response) => {
  try {
    const { apiKey, databaseId } = req.body;

    if (!apiKey || !databaseId) {
      return res
        .status(400)
        .json({ error: "apiKey y databaseId son requeridos" });
    }

    const result = await crmExportService.testNotionConnection({
      apiKey,
      databaseId,
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 🔗 Verificar conexión a Airtable
 */
app.post("/api/export/airtable/test", async (req: Request, res: Response) => {
  try {
    const { apiKey, baseId, tableName } = req.body;

    if (!apiKey || !baseId || !tableName) {
      return res
        .status(400)
        .json({ error: "apiKey, baseId y tableName son requeridos" });
    }

    const result = await crmExportService.testAirtableConnection({
      apiKey,
      baseId,
      tableName,
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 📋 Instrucciones de configuración CRM
 */
app.get("/api/export/setup/:crm", (req: Request, res: Response) => {
  const { crm } = req.params;

  if (crm === "notion") {
    res.json({ instructions: crmExportService.getNotionSetupInstructions() });
  } else if (crm === "airtable") {
    res.json({ instructions: crmExportService.getAirtableSetupInstructions() });
  } else {
    res.status(400).json({ error: "CRM no soportado. Usa: notion o airtable" });
  }
});

/**
 * 🎱 Estadísticas del Browser Pool
 */
app.get("/api/browser-pool/stats", (req: Request, res: Response) => {
  const stats = browserPool.getStats();
  res.json(stats);
});

// ==================== ERROR HANDLERS ====================

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint no encontrado",
    path: req.path,
    method: req.method,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error no manejado: ${err.message}`);
  res.status(500).json({
    error: "Error interno del servidor",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ==================== INICIAR SERVIDOR ====================

const server = app.listen(port, () => {
  logger.info("=".repeat(50));
  logger.info("🚀 Lead Scraper v3.0 - Puppeteer Edition");
  logger.info("=".repeat(50));
  logger.info(`📍 Servidor: http://localhost:${port}`);
  logger.info(`💰 Modo: GRATIS (sin API key)`);
  logger.info(`🔧 Motor: Puppeteer + Google Maps Scraping`);
  logger.info("=".repeat(50));
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("🛑 Apagando servidor...");
  await browserPool.shutdown();
  await placesService.shutdown();
  server.close(() => {
    logger.info("👋 Servidor apagado");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  logger.info("🛑 Apagando servidor...");
  await browserPool.shutdown();
  await placesService.shutdown();
  server.close(() => {
    logger.info("👋 Servidor apagado");
    process.exit(0);
  });
});

export default app;
