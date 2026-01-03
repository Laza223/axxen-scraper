/**
 * 🚫 ZONE SATURATION SERVICE - Detección de Zonas Agotadas
 *
 * Detecta cuando una zona/keyword ya ha sido muy trabajada
 * y sugiere zonas alternativas para buscar.
 *
 * Evita que el usuario pierda tiempo buscando en zonas sin leads nuevos.
 */

import logger from "./logger";

interface ZoneMetrics {
  zone: string;
  keyword: string;
  totalSearches: number;
  totalLeadsFound: number;
  totalDuplicates: number;
  lastSearch: Date;
  avgNewLeadsPerSearch: number;
  status: "fresh" | "warm" | "saturated" | "exhausted";
}

interface SaturationResult {
  isSaturated: boolean;
  status: "fresh" | "warm" | "saturated" | "exhausted";
  duplicateRate: number;
  recommendation: string;
  suggestedZones?: string[];
  metrics: ZoneMetrics;
}

// Zonas vecinas conocidas (Argentina)
const ZONE_NEIGHBORS: Record<string, string[]> = {
  // CABA
  palermo: ["belgrano", "villa crespo", "colegiales", "recoleta", "nuñez"],
  belgrano: ["nuñez", "colegiales", "palermo", "villa urquiza", "saavedra"],
  recoleta: ["palermo", "barrio norte", "retiro", "almagro"],
  caballito: ["flores", "almagro", "boedo", "parque chacabuco"],
  flores: ["floresta", "caballito", "parque chacabuco", "villa luro"],

  // Conurbano Norte
  "san isidro": ["vicente lopez", "san fernando", "martinez", "acassuso"],
  "vicente lopez": ["san isidro", "olivos", "florida", "munro"],
  tigre: ["san fernando", "escobar", "don torcuato", "pacheco"],
  pilar: ["escobar", "lujan", "campana", "del viso"],

  // Conurbano Sur
  quilmes: ["berazategui", "avellaneda", "wilde", "bernal"],
  lanus: ["avellaneda", "lomas de zamora", "banfield", "gerli"],
  "lomas de zamora": ["lanus", "banfield", "temperley", "adrogue"],

  // Conurbano Oeste
  moreno: ["merlo", "jose c paz", "general rodriguez", "paso del rey"],
  moron: ["hurlingham", "ituzaingo", "haedo", "castelar"],
  "la matanza": ["moron", "merlo", "ezeiza", "gonzalez catan"],

  // Interior
  cordoba: ["villa carlos paz", "alta gracia", "rio cuarto", "villa maria"],
  rosario: ["san lorenzo", "funes", "roldan", "casilda"],
  mendoza: ["godoy cruz", "guaymallen", "las heras", "maipu"],
  "mar del plata": ["miramar", "necochea", "villa gesell", "pinamar"],
  "la plata": ["city bell", "gonnet", "berisso", "ensenada"],
  neuquen: ["cipolletti", "plottier", "centenario", "san martin de los andes"],
  salta: ["oran", "tartagal", "cafayate", "general guemes"],
  tucuman: ["yerba buena", "tafi viejo", "banda del rio sali", "concepcion"],
};

class ZoneSaturationService {
  private metrics: Map<string, ZoneMetrics> = new Map();

  /**
   * Generar clave única para zona+keyword
   */
  private getKey(keyword: string, zone: string): string {
    return `${this.normalize(keyword)}:${this.normalize(zone)}`;
  }

  /**
   * Normalizar texto para comparación
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  /**
   * Registrar resultado de búsqueda y verificar saturación
   */
  checkSaturation(
    keyword: string,
    zone: string,
    newLeads: number,
    duplicates: number
  ): SaturationResult {
    const key = this.getKey(keyword, zone);
    const existing = this.metrics.get(key);

    // Crear o actualizar métricas
    const totalLeads = newLeads + duplicates;
    const duplicateRate = totalLeads > 0 ? (duplicates / totalLeads) * 100 : 0;

    let metrics: ZoneMetrics;

    if (existing) {
      // Actualizar métricas existentes
      existing.totalSearches++;
      existing.totalLeadsFound += newLeads;
      existing.totalDuplicates += duplicates;
      existing.lastSearch = new Date();
      existing.avgNewLeadsPerSearch =
        existing.totalLeadsFound / existing.totalSearches;

      metrics = existing;
    } else {
      // Nueva zona
      metrics = {
        zone,
        keyword,
        totalSearches: 1,
        totalLeadsFound: newLeads,
        totalDuplicates: duplicates,
        lastSearch: new Date(),
        avgNewLeadsPerSearch: newLeads,
        status: "fresh",
      };
    }

    // Determinar estado de saturación
    if (duplicateRate >= 90 && metrics.totalSearches >= 3) {
      metrics.status = "exhausted";
    } else if (duplicateRate >= 70 && metrics.totalSearches >= 2) {
      metrics.status = "saturated";
    } else if (duplicateRate >= 40) {
      metrics.status = "warm";
    } else {
      metrics.status = "fresh";
    }

    this.metrics.set(key, metrics);

    // Generar resultado
    const isSaturated =
      metrics.status === "saturated" || metrics.status === "exhausted";
    const recommendation = this.generateRecommendation(metrics, duplicateRate);
    const suggestedZones = isSaturated
      ? this.suggestNextZones(zone)
      : undefined;

    const result: SaturationResult = {
      isSaturated,
      status: metrics.status,
      duplicateRate,
      recommendation,
      suggestedZones,
      metrics,
    };

    // Log según estado
    if (metrics.status === "exhausted") {
      logger.warn(
        `🚫 Zona AGOTADA: "${keyword}" en "${zone}" | ${duplicateRate.toFixed(
          0
        )}% duplicados`
      );
    } else if (metrics.status === "saturated") {
      logger.warn(
        `⚠️ Zona SATURADA: "${keyword}" en "${zone}" | ${duplicateRate.toFixed(
          0
        )}% duplicados`
      );
    } else if (metrics.status === "warm") {
      logger.info(
        `🔶 Zona CALIENTE: "${keyword}" en "${zone}" | ${duplicateRate.toFixed(
          0
        )}% duplicados`
      );
    } else {
      logger.info(
        `✅ Zona FRESCA: "${keyword}" en "${zone}" | ${newLeads} leads nuevos`
      );
    }

    return result;
  }

  /**
   * Generar recomendación basada en métricas
   */
  private generateRecommendation(
    metrics: ZoneMetrics,
    duplicateRate: number
  ): string {
    switch (metrics.status) {
      case "exhausted":
        return (
          `🚫 Zona agotada después de ${metrics.totalSearches} búsquedas. ` +
          `Encontraste ${metrics.totalLeadsFound} leads aquí. ` +
          `Considera buscar en zonas vecinas.`
        );

      case "saturated":
        return (
          `⚠️ Zona muy trabajada (${duplicateRate.toFixed(0)}% duplicados). ` +
          `Promedio: ${metrics.avgNewLeadsPerSearch.toFixed(
            1
          )} leads nuevos por búsqueda. ` +
          `Recomendamos explorar zonas alternativas.`
        );

      case "warm":
        return (
          `🔶 Zona parcialmente explorada. ` +
          `Aún puedes encontrar leads, pero considera expandir a zonas vecinas.`
        );

      case "fresh":
        return `✅ Zona productiva con buenos resultados. Continúa buscando aquí.`;

      default:
        return "";
    }
  }

  /**
   * Sugerir zonas alternativas basado en la zona actual
   */
  private suggestNextZones(currentZone: string): string[] {
    const normalized = this.normalize(currentZone);

    // Buscar en el mapa de vecinos
    for (const [zone, neighbors] of Object.entries(ZONE_NEIGHBORS)) {
      if (normalized.includes(zone) || zone.includes(normalized)) {
        // Filtrar zonas que ya están saturadas
        return neighbors.filter((neighbor) => {
          const neighborMetrics = Array.from(this.metrics.values()).find((m) =>
            this.normalize(m.zone).includes(this.normalize(neighbor))
          );
          return (
            !neighborMetrics ||
            (neighborMetrics.status !== "exhausted" &&
              neighborMetrics.status !== "saturated")
          );
        });
      }
    }

    // Si no hay mapa, sugerir genéricas
    return ["zona norte", "zona sur", "zona oeste", "centro"];
  }

  /**
   * Obtener resumen de todas las zonas trabajadas
   */
  getSummary(): {
    totalZones: number;
    freshZones: number;
    warmZones: number;
    saturatedZones: number;
    exhaustedZones: number;
    totalLeadsFound: number;
    zones: ZoneMetrics[];
  } {
    const zones = Array.from(this.metrics.values());

    return {
      totalZones: zones.length,
      freshZones: zones.filter((z) => z.status === "fresh").length,
      warmZones: zones.filter((z) => z.status === "warm").length,
      saturatedZones: zones.filter((z) => z.status === "saturated").length,
      exhaustedZones: zones.filter((z) => z.status === "exhausted").length,
      totalLeadsFound: zones.reduce((sum, z) => sum + z.totalLeadsFound, 0),
      zones: zones.sort((a, b) => b.totalLeadsFound - a.totalLeadsFound),
    };
  }

  /**
   * Limpiar métricas antiguas (más de 24 horas)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.lastSearch.getTime() > maxAge) {
        this.metrics.delete(key);
      }
    }

    logger.info(
      `🧹 Limpieza de saturación: ${this.metrics.size} zonas activas`
    );
  }

  /**
   * Resetear todas las métricas
   */
  reset(): void {
    this.metrics.clear();
    logger.info("🔄 Métricas de saturación reseteadas");
  }
}

export const zoneSaturationService = new ZoneSaturationService();
export default zoneSaturationService;
