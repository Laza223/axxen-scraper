/**
 * 🗺️ Zone Service - Búsqueda inteligente por zonas
 *
 * Subdivide zonas grandes en sub-zonas más pequeñas para obtener más resultados.
 * Google Maps limita los resultados por búsqueda, así que buscando por barrios
 * obtenemos más leads que buscando por ciudad completa.
 */

import logger from "./logger";

// ==================== DEFINICIÓN DE ZONAS ====================

interface ZoneDefinition {
  aliases: string[]; // Nombres que activan esta zona
  subzones: string[]; // Sub-zonas para buscar
  country?: string; // País (para contexto)
}

/**
 * Mapa de zonas grandes → sub-zonas
 * Agregar más ciudades según necesidad
 */
const ZONE_MAP: Record<string, ZoneDefinition> = {
  // Argentina - Buenos Aires
  buenos_aires: {
    aliases: [
      "buenos aires",
      "caba",
      "capital federal",
      "ciudad de buenos aires",
      "ciudad autónoma de buenos aires",
    ],
    subzones: [
      "Palermo, Buenos Aires",
      "Belgrano, Buenos Aires",
      "Recoleta, Buenos Aires",
      "Caballito, Buenos Aires",
      "Villa Crespo, Buenos Aires",
      "Almagro, Buenos Aires",
      "San Telmo, Buenos Aires",
      "Puerto Madero, Buenos Aires",
      "Núñez, Buenos Aires",
      "Colegiales, Buenos Aires",
      "Villa Urquiza, Buenos Aires",
      "Devoto, Buenos Aires",
      "Flores, Buenos Aires",
      "Barrio Norte, Buenos Aires",
      "Microcentro, Buenos Aires",
    ],
    country: "Argentina",
  },

  // Argentina - Zona Norte GBA
  zona_norte: {
    aliases: ["zona norte", "zona norte buenos aires", "gba norte"],
    subzones: [
      "San Isidro, Buenos Aires",
      "Vicente López, Buenos Aires",
      "Olivos, Buenos Aires",
      "Martínez, Buenos Aires",
      "Tigre, Buenos Aires",
      "San Fernando, Buenos Aires",
      "Pilar, Buenos Aires",
      "Nordelta, Buenos Aires",
    ],
    country: "Argentina",
  },

  // Argentina - Córdoba
  cordoba: {
    aliases: ["córdoba", "cordoba", "cordoba capital", "córdoba capital"],
    subzones: [
      "Nueva Córdoba, Córdoba",
      "Centro, Córdoba",
      "Cerro de las Rosas, Córdoba",
      "General Paz, Córdoba",
      "Alta Córdoba, Córdoba",
      "Güemes, Córdoba",
      "Villa Belgrano, Córdoba",
      "Jardín, Córdoba",
    ],
    country: "Argentina",
  },

  // Argentina - Rosario
  rosario: {
    aliases: ["rosario", "rosario santa fe"],
    subzones: [
      "Centro, Rosario",
      "Pichincha, Rosario",
      "Fisherton, Rosario",
      "Arroyito, Rosario",
      "Echesortu, Rosario",
      "Alberdi, Rosario",
    ],
    country: "Argentina",
  },

  // Argentina - Mendoza
  mendoza: {
    aliases: ["mendoza", "mendoza capital"],
    subzones: [
      "Centro, Mendoza",
      "Godoy Cruz, Mendoza",
      "Guaymallén, Mendoza",
      "Las Heras, Mendoza",
      "Luján de Cuyo, Mendoza",
      "Chacras de Coria, Mendoza",
    ],
    country: "Argentina",
  },

  // México - CDMX
  cdmx: {
    aliases: [
      "ciudad de méxico",
      "cdmx",
      "df",
      "distrito federal",
      "mexico city",
    ],
    subzones: [
      "Polanco, CDMX",
      "Condesa, CDMX",
      "Roma Norte, CDMX",
      "Roma Sur, CDMX",
      "Santa Fe, CDMX",
      "Coyoacán, CDMX",
      "San Ángel, CDMX",
      "Del Valle, CDMX",
      "Nápoles, CDMX",
      "Juárez, CDMX",
      "Centro Histórico, CDMX",
      "Insurgentes, CDMX",
    ],
    country: "México",
  },

  // México - Guadalajara
  guadalajara: {
    aliases: ["guadalajara", "gdl", "guadalajara jalisco"],
    subzones: [
      "Centro, Guadalajara",
      "Providencia, Guadalajara",
      "Chapultepec, Guadalajara",
      "Americana, Guadalajara",
      "Zapopan, Guadalajara",
      "Tlaquepaque, Guadalajara",
    ],
    country: "México",
  },

  // México - Monterrey
  monterrey: {
    aliases: ["monterrey", "mty", "monterrey nuevo león"],
    subzones: [
      "Centro, Monterrey",
      "San Pedro Garza García, Monterrey",
      "Valle Oriente, Monterrey",
      "Cumbres, Monterrey",
      "Santa Catarina, Monterrey",
    ],
    country: "México",
  },

  // España - Madrid
  madrid: {
    aliases: ["madrid", "madrid españa", "madrid spain"],
    subzones: [
      "Centro, Madrid",
      "Salamanca, Madrid",
      "Chamberí, Madrid",
      "Retiro, Madrid",
      "Chamartín, Madrid",
      "Arganzuela, Madrid",
      "Malasaña, Madrid",
      "La Latina, Madrid",
      "Lavapiés, Madrid",
    ],
    country: "España",
  },

  // España - Barcelona
  barcelona: {
    aliases: ["barcelona", "barcelona españa", "barcelona spain"],
    subzones: [
      "Eixample, Barcelona",
      "Gràcia, Barcelona",
      "Barceloneta, Barcelona",
      "El Born, Barcelona",
      "Gótico, Barcelona",
      "Poble Sec, Barcelona",
      "Sant Gervasi, Barcelona",
      "Sarrià, Barcelona",
    ],
    country: "España",
  },

  // Colombia - Bogotá
  bogota: {
    aliases: ["bogotá", "bogota", "bogota colombia"],
    subzones: [
      "Chapinero, Bogotá",
      "Usaquén, Bogotá",
      "La Candelaria, Bogotá",
      "Zona Rosa, Bogotá",
      "Chicó, Bogotá",
      "Cedritos, Bogotá",
      "Zona G, Bogotá",
    ],
    country: "Colombia",
  },

  // Chile - Santiago
  santiago: {
    aliases: [
      "santiago",
      "santiago de chile",
      "santiago chile",
      "santiago centro",
    ],
    subzones: [
      "Providencia, Santiago",
      "Las Condes, Santiago",
      "Vitacura, Santiago",
      "Ñuñoa, Santiago",
      "La Reina, Santiago",
      "Santiago Centro, Chile",
      "Bellavista, Santiago",
    ],
    country: "Chile",
  },

  // Perú - Lima
  lima: {
    aliases: ["lima", "lima perú", "lima peru"],
    subzones: [
      "Miraflores, Lima",
      "San Isidro, Lima",
      "Barranco, Lima",
      "Surco, Lima",
      "La Molina, Lima",
      "San Borja, Lima",
      "Lince, Lima",
    ],
    country: "Perú",
  },
};

// ==================== FUNCIONES PÚBLICAS ====================

export interface ZoneAnalysis {
  isLargeZone: boolean;
  originalLocation: string;
  subzones: string[];
  zoneName?: string;
  country?: string;
}

/**
 * Analiza si una ubicación es una zona grande que se puede subdividir
 * NOTA: Solo subdivide si la ubicación ES la zona grande, no si la contiene
 */
export function analyzeZone(location: string): ZoneAnalysis {
  const normalized = location.toLowerCase().trim();

  for (const [zoneName, definition] of Object.entries(ZONE_MAP)) {
    for (const alias of definition.aliases) {
      // Solo match exacto o casi exacto (ignorando país al final)
      // Ej: "Buenos Aires" o "Buenos Aires, Argentina" → match
      // Pero "Lujan, Buenos Aires" → NO match
      const isExactMatch = normalized === alias;
      const isWithCountry =
        normalized === `${alias}, ${definition.country?.toLowerCase()}` ||
        normalized === `${alias} ${definition.country?.toLowerCase()}`;

      if (isExactMatch || isWithCountry) {
        logger.info(
          `🗺️ Zona grande detectada: "${location}" → ${definition.subzones.length} sub-zonas`
        );
        return {
          isLargeZone: true,
          originalLocation: location,
          subzones: definition.subzones,
          zoneName,
          country: definition.country,
        };
      }
    }
  }

  // Si no es zona grande conocida, buscar directamente en esa ubicación
  logger.info(`📍 Ubicación específica: "${location}" (búsqueda directa)`);
  return {
    isLargeZone: false,
    originalLocation: location,
    subzones: [location],
  };
}

/**
 * Obtiene todas las zonas disponibles (para mostrar en UI)
 */
export function getAvailableZones(): Array<{
  name: string;
  aliases: string[];
  subzoneCount: number;
  country?: string;
}> {
  return Object.entries(ZONE_MAP).map(([name, def]) => ({
    name,
    aliases: def.aliases,
    subzoneCount: def.subzones.length,
    country: def.country,
  }));
}

/**
 * Agrega una zona personalizada en runtime
 */
export function addCustomZone(
  name: string,
  aliases: string[],
  subzones: string[],
  country?: string
): void {
  ZONE_MAP[name.toLowerCase().replace(/\s+/g, "_")] = {
    aliases: aliases.map((a) => a.toLowerCase()),
    subzones,
    country,
  };
  logger.info(
    `➕ Zona personalizada agregada: ${name} (${subzones.length} sub-zonas)`
  );
}

/**
 * Estima el tiempo de scraping para una zona
 */
export function estimateScrapeTime(location: string): {
  subzones: number;
  estimatedMinutes: number;
  estimatedLeads: { min: number; max: number };
} {
  const analysis = analyzeZone(location);
  const subzoneCount = analysis.subzones.length;

  // ~30 segundos por sub-zona + overhead
  const estimatedMinutes = Math.ceil((subzoneCount * 30 + 10) / 60);

  // ~5-15 leads por sub-zona (conservador)
  const estimatedLeads = {
    min: subzoneCount * 5,
    max: subzoneCount * 15,
  };

  return {
    subzones: subzoneCount,
    estimatedMinutes,
    estimatedLeads,
  };
}
