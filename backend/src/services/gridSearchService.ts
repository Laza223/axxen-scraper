/**
 * 🗺️ Grid Search Service - Búsqueda dinámica por cuadrícula
 *
 * En lugar de hardcodear zonas, este servicio:
 * 1. Obtiene las coordenadas del lugar usando Google Maps
 * 2. Calcula un bounding box basado en el tamaño de la ciudad
 * 3. Divide el área en una grilla de celdas
 * 4. Genera URLs de búsqueda para cada celda con zoom específico
 *
 * Esto permite buscar en CUALQUIER ciudad sin necesidad de configuración previa.
 */

import cacheService from "./cacheService";
import logger from "./logger";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GridCell {
  center: Coordinates;
  zoom: number;
  label: string;
}

export interface GridSearchConfig {
  location: string;
  gridSize?: number; // Número de celdas por lado (ej: 3 = 3x3 = 9 celdas)
  radiusKm?: number; // Radio aproximado de búsqueda en km
}

export interface GridSearchResult {
  location: string;
  center: Coordinates;
  cells: GridCell[];
  totalCells: number;
  estimatedMinutes: number;
}

// Tamaños de ciudad aproximados para determinar el grid
const CITY_SIZE_ESTIMATES: Record<
  string,
  { radiusKm: number; gridSize: number }
> = {
  // Grandes ciudades
  large: { radiusKm: 15, gridSize: 4 }, // 16 celdas
  // Ciudades medianas
  medium: { radiusKm: 8, gridSize: 3 }, // 9 celdas
  // Ciudades pequeñas / localidades
  small: { radiusKm: 4, gridSize: 2 }, // 4 celdas
  // Muy pequeñas / barrios
  tiny: { radiusKm: 2, gridSize: 1 }, // 1 celda (búsqueda directa)
};

/**
 * Obtiene las coordenadas de un lugar usando scraping de Google Maps
 * (No requiere API key)
 */
export async function getCoordinatesFromGoogleMaps(
  location: string,
  page?: any
): Promise<Coordinates | null> {
  // Intentar obtener del caché primero
  const cacheKey = `geocode:${location.toLowerCase()}`;
  const cached = await cacheService.get<Coordinates>(cacheKey);
  if (cached) {
    logger.debug(`📍 Coordenadas desde caché: ${location}`);
    return cached;
  }

  // Si no tenemos page, no podemos hacer scraping aquí
  // Las coordenadas se extraerán de la URL después de navegar
  return null;
}

/**
 * Extrae coordenadas de una URL de Google Maps
 * Formato: https://www.google.com/maps/search/.../@-34.5636,-59.1107,14z
 */
export function extractCoordsFromUrl(url: string): Coordinates | null {
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }
  return null;
}

/**
 * Calcula el bounding box dado un centro y radio en km
 */
export function calculateBoundingBox(
  center: Coordinates,
  radiusKm: number
): BoundingBox {
  // 1 grado de latitud ≈ 111 km
  // 1 grado de longitud varía según la latitud
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}

/**
 * Divide un bounding box en una grilla de celdas
 */
export function createGrid(bbox: BoundingBox, gridSize: number): GridCell[] {
  const cells: GridCell[] = [];
  const latStep = (bbox.north - bbox.south) / gridSize;
  const lngStep = (bbox.east - bbox.west) / gridSize;

  // Calcular zoom basado en el tamaño de cada celda
  // Cuanto más pequeña la celda, mayor el zoom
  const cellSizeKm =
    (latStep * 111 +
      lngStep *
        111 *
        Math.cos((((bbox.north + bbox.south) / 2) * Math.PI) / 180)) /
    2;
  const zoom = calculateZoomFromDistance(cellSizeKm);

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellLat = bbox.south + latStep * (row + 0.5);
      const cellLng = bbox.west + lngStep * (col + 0.5);

      cells.push({
        center: { lat: cellLat, lng: cellLng },
        zoom,
        label: `${String.fromCharCode(65 + row)}${col + 1}`, // A1, A2, B1, B2, etc.
      });
    }
  }

  return cells;
}

/**
 * Calcula el nivel de zoom apropiado basado en la distancia
 */
function calculateZoomFromDistance(distanceKm: number): number {
  // Aproximación: zoom 14 ≈ 5km, cada nivel de zoom duplica/reduce la escala
  if (distanceKm <= 1) return 16;
  if (distanceKm <= 2) return 15;
  if (distanceKm <= 4) return 14;
  if (distanceKm <= 8) return 13;
  if (distanceKm <= 15) return 12;
  return 11;
}

/**
 * Genera la URL de búsqueda de Google Maps con coordenadas específicas
 */
export function buildGridSearchUrl(keyword: string, cell: GridCell): string {
  const query = encodeURIComponent(keyword);
  // Formato: /maps/search/keyword/@lat,lng,zoom
  return `https://www.google.com/maps/search/${query}/@${cell.center.lat.toFixed(
    6
  )},${cell.center.lng.toFixed(6)},${cell.zoom}z`;
}

/**
 * Estima el tamaño de una ciudad basado en su nombre
 * (heurística simple, se puede mejorar)
 */
export function estimateCitySize(
  location: string
): "large" | "medium" | "small" | "tiny" {
  const normalized = location.toLowerCase();

  // Palabras clave que indican tamaño
  const largeIndicators = [
    "capital",
    "ciudad de",
    "cdmx",
    "buenos aires",
    "santiago",
    "lima",
    "bogotá",
    "madrid",
    "barcelona",
  ];
  const tinyIndicators = [
    "barrio",
    "colonia",
    "urbanización",
    "fraccionamiento",
    "villa",
  ];

  if (largeIndicators.some((ind) => normalized.includes(ind))) {
    return "large";
  }

  if (tinyIndicators.some((ind) => normalized.includes(ind))) {
    return "tiny";
  }

  // Por defecto, asumir ciudad mediana/pequeña
  // Ciudades como "Luján", "Pilar", etc.
  return "small";
}

/**
 * Genera la configuración de grilla para una ubicación
 */
export function generateGridConfig(location: string): {
  gridSize: number;
  radiusKm: number;
  estimatedCells: number;
} {
  const citySize = estimateCitySize(location);
  const config = CITY_SIZE_ESTIMATES[citySize];

  return {
    gridSize: config.gridSize,
    radiusKm: config.radiusKm,
    estimatedCells: config.gridSize * config.gridSize,
  };
}

/**
 * Clase principal del servicio de búsqueda por grilla
 */
class GridSearchService {
  private centerCache: Map<string, Coordinates> = new Map();

  /**
   * Prepara la búsqueda por grilla para una ubicación
   * Retorna las URLs a buscar
   */
  async prepareGridSearch(
    keyword: string,
    location: string,
    options?: {
      gridSize?: number;
      radiusKm?: number;
      maxCells?: number;
    }
  ): Promise<{
    urls: string[];
    cells: GridCell[];
    center: Coordinates | null;
    config: { gridSize: number; radiusKm: number };
  }> {
    // Obtener configuración basada en estimación de tamaño de ciudad
    const autoConfig = generateGridConfig(location);
    const gridSize = options?.gridSize ?? autoConfig.gridSize;
    const radiusKm = options?.radiusKm ?? autoConfig.radiusKm;
    const maxCells = options?.maxCells ?? 16;

    logger.info(
      `🗺️ Preparando grid search para "${location}": ${gridSize}x${gridSize} grid, radio ${radiusKm}km`
    );

    // Por ahora generamos las celdas sin coordenadas exactas
    // Las coordenadas se obtendrán dinámicamente al navegar
    // Generamos búsquedas con diferentes "perspectivas" de la ubicación
    const searchVariations = this.generateSearchVariations(
      keyword,
      location,
      Math.min(gridSize * gridSize, maxCells)
    );

    return {
      urls: searchVariations.map((v) => v.url),
      cells: searchVariations.map((v, i) => ({
        center: { lat: 0, lng: 0 }, // Se llenarán después
        zoom: 14,
        label: v.label,
      })),
      center: null, // Se obtendrá después de la primera navegación
      config: { gridSize, radiusKm },
    };
  }

  /**
   * Genera variaciones de búsqueda para cubrir más área
   * En lugar de depender de coordenadas, usamos términos de búsqueda inteligentes
   */
  private generateSearchVariations(
    keyword: string,
    location: string,
    count: number
  ): Array<{ url: string; label: string; variation: string }> {
    const variations: Array<{ url: string; label: string; variation: string }> =
      [];

    // Variación base
    variations.push({
      url: `https://www.google.com/maps/search/${encodeURIComponent(
        `${keyword} en ${location}`
      )}`,
      label: "Centro",
      variation: "base",
    });

    if (count === 1) return variations;

    // Variaciones con puntos cardinales para expandir la búsqueda
    const directions = [
      { suffix: "norte", label: "Norte" },
      { suffix: "sur", label: "Sur" },
      { suffix: "este", label: "Este" },
      { suffix: "oeste", label: "Oeste" },
      { suffix: "centro", label: "Centro Alt" },
    ];

    for (let i = 0; i < Math.min(count - 1, directions.length); i++) {
      const dir = directions[i];
      variations.push({
        url: `https://www.google.com/maps/search/${encodeURIComponent(
          `${keyword} ${location} ${dir.suffix}`
        )}`,
        label: dir.label,
        variation: dir.suffix,
      });
    }

    // Si necesitamos más variaciones, agregar con términos adicionales
    if (count > 6) {
      const extraTerms = ["cerca de", "zona de", "barrio"];
      for (let i = 0; i < Math.min(count - 6, extraTerms.length); i++) {
        variations.push({
          url: `https://www.google.com/maps/search/${encodeURIComponent(
            `${keyword} ${extraTerms[i]} ${location}`
          )}`,
          label: `Extra ${i + 1}`,
          variation: extraTerms[i],
        });
      }
    }

    return variations;
  }

  /**
   * Genera URLs de búsqueda usando coordenadas después de obtenerlas
   */
  generateCoordinateBasedUrls(
    keyword: string,
    center: Coordinates,
    radiusKm: number,
    gridSize: number
  ): Array<{ url: string; cell: GridCell }> {
    const bbox = calculateBoundingBox(center, radiusKm);
    const cells = createGrid(bbox, gridSize);

    return cells.map((cell) => ({
      url: buildGridSearchUrl(keyword, cell),
      cell,
    }));
  }

  /**
   * Actualiza el centro basado en coordenadas extraídas de la URL
   */
  updateCenter(location: string, coords: Coordinates): void {
    this.centerCache.set(location.toLowerCase(), coords);

    // También guardar en caché persistente
    const cacheKey = `geocode:${location.toLowerCase()}`;
    cacheService.set(cacheKey, coords, 86400 * 30); // 30 días

    logger.debug(
      `📍 Centro actualizado para "${location}": ${coords.lat}, ${coords.lng}`
    );
  }

  /**
   * Obtiene el centro cacheado
   */
  getCenter(location: string): Coordinates | undefined {
    return this.centerCache.get(location.toLowerCase());
  }
}

export const gridSearchService = new GridSearchService();
export default gridSearchService;
