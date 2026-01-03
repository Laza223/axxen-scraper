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

// Tamaños de área para determinar el grid
// Actualizado con soporte para PROVINCIAS y regiones extensas
// 🆕 MEJORADO: Grillas más densas para encontrar más resultados
const CITY_SIZE_ESTIMATES: Record<
  string,
  { radiusKm: number; gridSize: number }
> = {
  // 🆕 PROVINCIAS completas (Buenos Aires, Córdoba, Santa Fe, etc.)
  province: { radiusKm: 150, gridSize: 8 }, // 64 celdas - cobertura provincial amplia
  // 🆕 Regiones/zonas grandes (Zona Norte GBA, Costa Atlántica, etc.)
  region: { radiusKm: 60, gridSize: 6 }, // 36 celdas - cobertura regional
  // Grandes ciudades (CABA, Córdoba Capital, Rosario, Neuquén Capital, etc.)
  // 🆕 MEJORADO: 6x6=36 celdas en lugar de 5x5=25 para más cobertura
  large: { radiusKm: 30, gridSize: 6 }, // 36 celdas - cobertura exhaustiva
  // Ciudades medianas (Pilar, Moreno, La Plata, etc.)
  // 🆕 MEJORADO: 5x5=25 celdas en lugar de 4x4=16
  medium: { radiusKm: 15, gridSize: 5 }, // 25 celdas - mejor cobertura
  // Ciudades pequeñas / localidades
  small: { radiusKm: 8, gridSize: 4 }, // 16 celdas
  // Muy pequeñas / barrios específicos
  tiny: { radiusKm: 4, gridSize: 3 }, // 9 celdas
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
 * 🆕 Actualizado para soportar celdas más grandes de búsquedas provinciales
 */
function calculateZoomFromDistance(distanceKm: number): number {
  // Aproximación: zoom 14 ≈ 5km, cada nivel de zoom duplica/reduce la escala
  if (distanceKm <= 1) return 16;
  if (distanceKm <= 2) return 15;
  if (distanceKm <= 5) return 14;
  if (distanceKm <= 10) return 13;
  if (distanceKm <= 20) return 12;
  if (distanceKm <= 40) return 11;
  if (distanceKm <= 80) return 10; // 🆕 Para celdas de regiones
  if (distanceKm <= 150) return 9; // 🆕 Para celdas de provincias
  return 8; // 🆕 Para áreas muy extensas
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
 * Estima el tamaño de una ubicación basado en su nombre
 * Mejorado para reconocer PROVINCIAS, regiones y localidades argentinas
 */
export function estimateCitySize(
  location: string
): "province" | "region" | "large" | "medium" | "small" | "tiny" {
  const normalized = location
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 🆕 PROVINCIAS ARGENTINAS (áreas muy extensas)
  const provinceIndicators = [
    // Provincias completas (sin "capital")
    "provincia de buenos aires",
    "provincia de cordoba",
    "provincia de santa fe",
    "provincia de mendoza",
    "provincia de tucuman",
    "provincia de salta",
    "provincia de entre rios",
    "provincia de misiones",
    "provincia de chaco",
    "provincia de corrientes",
    "provincia de santiago del estero",
    "provincia de san juan",
    "provincia de jujuy",
    "provincia de rio negro",
    "provincia de neuquen",
    "provincia de formosa",
    "provincia de chubut",
    "provincia de san luis",
    "provincia de catamarca",
    "provincia de la rioja",
    "provincia de la pampa",
    "provincia de santa cruz",
    "provincia de tierra del fuego",
    // Variantes sin "provincia de"
    "buenos aires provincia",
    "gba completo",
    "gran buenos aires",
  ];

  // 🆕 Detectar si es solo el nombre de una provincia (sin ciudad específica)
  const onlyProvinceNames = [
    // Si dice SOLO "buenos aires" sin especificar ciudad, es la provincia
    // Pero debemos verificar que no tenga indicadores de ciudad
  ];

  // 🆕 REGIONES / ZONAS extensas
  const regionIndicators = [
    "zona norte",
    "zona sur",
    "zona oeste",
    "zona este",
    "conurbano",
    "conurbano bonaerense",
    "costa atlantica",
    "interior de",
    "region pampeana",
    "region patagonica",
    "region cuyo",
    "region noa",
    "region nea",
    "litoral argentino",
    "noroeste argentino",
    "noreste argentino",
    // Partidos grandes que son casi regiones
    "la matanza completo",
    "todo pilar",
    "todo escobar",
  ];

  // Ciudades GRANDES (capitales, ciudades principales > 100k habitantes)
  const largeIndicators = [
    // CABA
    "capital federal",
    "caba",
    "ciudad autonoma",
    "buenos aires ciudad",
    // Córdoba
    "cordoba capital",
    "ciudad de cordoba",
    // Rosario
    "rosario",
    "gran rosario",
    // Mendoza
    "mendoza capital",
    "ciudad de mendoza",
    // Tucumán
    "tucuman capital",
    "san miguel de tucuman",
    // La Plata
    "la plata",
    // Mar del Plata
    "mar del plata",
    // Salta
    "salta capital",
    "ciudad de salta",
    // Santa Fe
    "santa fe capital",
    "ciudad de santa fe",
    // San Juan
    "san juan capital",
    "ciudad de san juan",
    "gran san juan",
    // Resistencia (Chaco)
    "resistencia",
    "gran resistencia",
    // Corrientes
    "corrientes capital",
    "ciudad de corrientes",
    // Posadas (Misiones)
    "posadas",
    "ciudad de posadas",
    // Neuquén
    "neuquen capital",
    "ciudad de neuquen",
    // Paraná (Entre Ríos)
    "parana",
    "ciudad de parana",
    // Santiago del Estero
    "santiago del estero capital",
    "ciudad de santiago",
    // San Salvador de Jujuy
    "san salvador de jujuy",
    "jujuy capital",
    // Formosa
    "formosa capital",
    "ciudad de formosa",
    // San Luis
    "san luis capital",
    "ciudad de san luis",
    // Río Cuarto
    "rio cuarto",
    // Bahía Blanca
    "bahia blanca",
    // Comodoro Rivadavia
    "comodoro rivadavia",
    // San Fernando del Valle de Catamarca
    "catamarca capital",
    "san fernando del valle",
    // La Rioja
    "la rioja capital",
    "ciudad de la rioja",
    // San Rafael
    "san rafael",
    // Concordia
    "concordia",
    // Villa María
    "villa maria",
    // Santa Rosa (La Pampa)
    "santa rosa la pampa",
    // Rafaela
    "rafaela",
    // Trelew
    "trelew",
    // Río Gallegos
    "rio gallegos",
    // Ushuaia
    "ushuaia",
    // Viedma
    "viedma",
    // Rawson
    "rawson",
  ];

  // Partidos/ciudades MEDIANAS (conurbano + ciudades 20k-100k)
  const mediumIndicators = [
    // ===== CONURBANO BONAERENSE =====
    // Zona Norte
    "pilar",
    "tigre",
    "san isidro",
    "vicente lopez",
    "san fernando",
    "escobar",
    "campana",
    "zarate",
    "exaltacion de la cruz",
    // Zona Oeste
    "moreno",
    "merlo",
    "moron",
    "hurlingham",
    "ituzaingo",
    "la matanza",
    "tres de febrero",
    "san miguel",
    "jose c paz",
    "jose c. paz",
    "malvinas argentinas",
    "general rodriguez",
    "lujan",
    "marcos paz",
    // Zona Sur
    "quilmes",
    "lanus",
    "avellaneda",
    "lomas de zamora",
    "almirante brown",
    "berazategui",
    "florencio varela",
    "esteban echeverria",
    "ezeiza",
    "presidente peron",
    "san vicente",

    // ===== INTERIOR BUENOS AIRES =====
    "san nicolas",
    "pergamino",
    "tandil",
    "olavarria",
    "junin",
    "chivilcoy",
    "necochea",
    "azul",
    "trenque lauquen",
    "mercedes",
    "bragado",
    "chacabuco",
    "nueve de julio",
    "tres arroyos",
    "bolivar",
    "pehuajo",
    "lincoln",
    "lobos",
    "chascomus",
    "dolores",
    "pinamar",
    "villa gesell",
    "miramar",
    "general pueyrredon",
    "coronel suarez",
    "general villegas",

    // ===== CÓRDOBA =====
    "villa carlos paz",
    "alta gracia",
    "villa allende",
    "jesus maria",
    "cosquin",
    "la falda",
    "bell ville",
    "san francisco cordoba",
    "marcos juarez",
    "morteros",
    "cruz del eje",
    "dean funes",
    "corral de bustos",
    "arroyito",

    // ===== SANTA FE =====
    "venado tuerto",
    "reconquista",
    "san lorenzo",
    "casilda",
    "esperanza",
    "san justo santa fe",
    "sunchales",
    "rufino",
    "villa constitucion",
    "granadero baigorria",
    "funes",
    "roldan",

    // ===== MENDOZA =====
    "godoy cruz",
    "guaymallen",
    "las heras mendoza",
    "maipu mendoza",
    "lujan de cuyo",
    "general alvear",
    "rivadavia mendoza",
    "tunuyan",
    "san martin mendoza",
    "malargue",

    // ===== TUCUMÁN =====
    "banda del rio sali",
    "yerba buena",
    "tafi viejo",
    "concepcion tucuman",
    "alderetes",
    "monteros",
    "aguilares",

    // ===== ENTRE RÍOS =====
    "gualeguaychu",
    "concepcion del uruguay",
    "gualeguay",
    "colon entre rios",
    "victoria entre rios",
    "villaguay",
    "la paz entre rios",
    "crespo",
    "san jose de feliciano",

    // ===== CHACO =====
    "presidencia roque saenz pena",
    "villa angela",
    "charata",
    "general san martin chaco",
    "quitilipi",
    "machagai",

    // ===== MISIONES =====
    "obera",
    "eldorado",
    "puerto iguazu",
    "jardin america",
    "leandro n alem",
    "apostoles",
    "montecarlo",
    "san vicente misiones",

    // ===== CORRIENTES =====
    "goya",
    "paso de los libres",
    "curuzú cuatia",
    "santo tome corrientes",
    "bella vista corrientes",
    "mercedes corrientes",

    // ===== SALTA =====
    "oran",
    "tartagal",
    "general guemes",
    "metan",
    "rosario de la frontera",
    "cafayate",
    "embarcacion",

    // ===== JUJUY =====
    "san pedro de jujuy",
    "libertador general san martin",
    "palpala",
    "humahuaca",
    "tilcara",
    "la quiaca",

    // ===== SANTIAGO DEL ESTERO =====
    "la banda",
    "teran",
    "frias",
    "anatuya",
    "quimili",
    "añatuya",

    // ===== NEUQUÉN =====
    "centenario",
    "plottier",
    "cutral co",
    "plaza huincul",
    "zapala",
    "san martin de los andes",
    "villa la angostura",
    "junin de los andes",
    "chos malal",

    // ===== RÍO NEGRO =====
    "general roca",
    "cipolletti",
    "san carlos de bariloche",
    "bariloche",
    "allen",
    "villa regina",
    "cervantes",
    "cinco saltos",
    "el bolson",

    // ===== CHUBUT =====
    "puerto madryn",
    "esquel",
    "sarmiento chubut",

    // ===== SAN JUAN =====
    "rawson san juan",
    "chimbas",
    "rivadavia san juan",
    "pocito",
    "santa lucia san juan",
    "caucete",

    // ===== SAN LUIS =====
    "villa mercedes san luis",
    "merlo san luis",
    "la punta san luis",

    // ===== CATAMARCA =====
    "valle viejo",
    "fray mamerto esquiu",
    "tinogasta",
    "belen catamarca",

    // ===== LA RIOJA =====
    "chilecito",
    "aimogasta",
    "chamical",

    // ===== LA PAMPA =====
    "general pico",
    "toay",
    "eduardo castex",
    "general acha",

    // ===== SANTA CRUZ =====
    "caleta olivia",
    "pico truncado",
    "puerto deseado",
    "el calafate",
    "las heras santa cruz",

    // ===== TIERRA DEL FUEGO =====
    "rio grande",
    "tolhuin",
  ];

  // Localidades PEQUEÑAS / barrios específicos / poblaciones menores
  const smallIndicators = [
    // Indicadores genéricos de barrios
    "barrio",
    "barrio cerrado",
    "localidad de",
    "villa",
    "country",
    "club de campo",
    "pueblo",
    "paraje",
    "comuna",
    "colonia",
    "parque industrial",

    // Barrios conocidos de CABA
    "palermo",
    "recoleta",
    "belgrano",
    "caballito",
    "nuñez",
    "saavedra",
    "villa urquiza",
    "villa devoto",
    "villa del parque",
    "villa crespo",
    "almagro",
    "boedo",
    "san telmo",
    "la boca",
    "barracas",
    "parque patricios",
    "flores",
    "floresta",
    "liniers",
    "mataderos",
    "villa lugano",
    "villa soldati",
    "villa riachuelo",
    "pompeya",
    "constitución",
    "monserrat",
    "san nicolas caba",
    "retiro",
    "puerto madero",
    "colegiales",
    "chacarita",
    "paternal",
    "agronomia",
    "villa ortuzar",
    "parque chas",
    "villa pueyrredon",
    "villa real",
    "versalles",
    "monte castro",
    "velez sarsfield",
    "villa luro",
    "parque avellaneda",
    "villa general mitre",
    "coghlan",

    // Algunas localidades pequeñas de Buenos Aires
    "city bell",
    "gonnet",
    "villa elisa",
    "arturo segui",
    "ringuelet",
    "tolosa",
    "los hornos",
    "san carlos la plata",
    "gorina",
    "hernandez",
    "del viso",
    "maquinista savio",
    "benavidez",
    "don torcuato",
    "general pacheco",
    "el talar",
    "ricardo rojas",
    "nordelta",
    "villanueva",
    "fisherton",
    "funes pueblo",
    "carcaraña",
    "puerto san martin",

    // Barrios de otras ciudades
    "nueva cordoba",
    "cerro de las rosas",
    "guemes cordoba",
    "alta cordoba",
    "centro cordoba",
  ];

  // Verificar tamaño en orden (de mayor a menor)

  // 🆕 Primero verificar si es una PROVINCIA
  if (provinceIndicators.some((ind) => normalized.includes(ind))) {
    return "province";
  }

  // 🆕 Verificar REGIONES
  if (regionIndicators.some((ind) => normalized.includes(ind))) {
    return "region";
  }

  // Verificar si es una ciudad grande
  if (largeIndicators.some((ind) => normalized.includes(ind))) {
    return "large";
  }

  // Verificar ciudades medianas
  if (mediumIndicators.some((ind) => normalized.includes(ind))) {
    return "medium";
  }

  // Verificar localidades pequeñas
  if (smallIndicators.some((ind) => normalized.includes(ind))) {
    return "tiny";
  }

  // 🆕 HEURÍSTICA: Si contiene "provincia" en cualquier parte, tratarlo como provincia
  if (normalized.includes("provincia")) {
    return "province";
  }

  // 🆕 HEURÍSTICA: Si es SOLO el nombre de una provincia conocida (sin ciudad)
  const pureProvinceNames = [
    "buenos aires",
    "cordoba",
    "santa fe",
    "mendoza",
    "tucuman",
    "salta",
    "entre rios",
    "misiones",
    "chaco",
    "corrientes",
    "santiago del estero",
    "san juan",
    "jujuy",
    "rio negro",
    "neuquen",
    "formosa",
    "chubut",
    "san luis",
    "catamarca",
    "la rioja",
    "la pampa",
    "santa cruz",
    "tierra del fuego",
  ];

  // Si el texto normalizado es EXACTAMENTE una provincia (o muy similar)
  for (const prov of pureProvinceNames) {
    // Si es exacto o termina con ", argentina" o "argentina"
    if (
      normalized === prov ||
      normalized === `${prov} argentina` ||
      normalized === `${prov}, argentina`
    ) {
      return "province";
    }
  }

  // Por defecto, asumir ciudad pequeña (cubrir bien sin excederse)
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
    const maxCells = options?.maxCells ?? 64; // 🆕 Aumentado para provincias

    logger.info(
      `🗺️ Preparando grid search para "${location}": ${gridSize}x${gridSize} grid, radio ${radiusKm}km`
    );

    // 🆕 Para provincias, usar búsqueda por ciudades principales
    const citySize = estimateCitySize(location);
    let searchVariations;

    if (citySize === "province" || citySize === "region") {
      searchVariations = this.generateProvincialSearchVariations(
        keyword,
        location,
        maxCells
      );
      logger.info(
        `🗺️ Modo provincial/regional: ${searchVariations.length} ciudades a buscar`
      );
    } else {
      // Por ahora generamos las celdas sin coordenadas exactas
      // Las coordenadas se obtendrán dinámicamente al navegar
      // Generamos búsquedas con diferentes "perspectivas" de la ubicación
      searchVariations = this.generateSearchVariations(
        keyword,
        location,
        Math.min(gridSize * gridSize, maxCells)
      );
    }

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
   * 🆕 Genera variaciones de búsqueda para PROVINCIAS
   * Busca en las ciudades principales de la provincia
   */
  private generateProvincialSearchVariations(
    keyword: string,
    location: string,
    maxCities: number
  ): Array<{ url: string; label: string; variation: string }> {
    const variations: Array<{ url: string; label: string; variation: string }> =
      [];
    const normalized = location
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Mapeo de provincias a sus ciudades principales
    const provinceCities: Record<string, string[]> = {
      "buenos aires": [
        "La Plata",
        "Mar del Plata",
        "Bahía Blanca",
        "Tandil",
        "San Nicolás",
        "Pergamino",
        "Junín",
        "Olavarría",
        "Necochea",
        "Luján",
        "Zárate",
        "Campana",
        "San Pedro",
        "Chivilcoy",
        "Mercedes",
        "Azul",
        "Trenque Lauquen",
        "9 de Julio",
        "Dolores",
        "Chascomús",
        "Pilar",
        "Tigre",
        "San Isidro",
        "Quilmes",
        "Moreno",
        "La Matanza",
        "Lomas de Zamora",
        "Lanús",
        "Avellaneda",
        "Florencio Varela",
      ],
      cordoba: [
        "Córdoba Capital",
        "Villa María",
        "Río Cuarto",
        "San Francisco",
        "Villa Carlos Paz",
        "Alta Gracia",
        "Jesús María",
        "Cosquín",
        "La Falda",
        "Bell Ville",
        "Villa Dolores",
        "Río Tercero",
        "Marcos Juárez",
        "Cruz del Eje",
        "Dean Funes",
      ],
      "santa fe": [
        "Rosario",
        "Santa Fe Capital",
        "Rafaela",
        "Venado Tuerto",
        "Reconquista",
        "Villa Constitución",
        "Casilda",
        "Esperanza",
        "San Lorenzo",
        "Cañada de Gómez",
        "Sunchales",
        "Rufino",
        "Villa Gobernador Gálvez",
        "Firmat",
        "Santo Tomé",
      ],
      mendoza: [
        "Mendoza Capital",
        "San Rafael",
        "Godoy Cruz",
        "Guaymallén",
        "Las Heras",
        "Maipú",
        "Luján de Cuyo",
        "Tunuyán",
        "San Martín",
        "Rivadavia",
      ],
      tucuman: [
        "San Miguel de Tucumán",
        "Concepción",
        "Yerba Buena",
        "Banda del Río Salí",
        "Tafí Viejo",
        "Famaillá",
        "Monteros",
        "Aguilares",
        "Lules",
      ],
      salta: [
        "Salta Capital",
        "San Ramón de la Nueva Orán",
        "Tartagal",
        "Metán",
        "General Güemes",
        "Cafayate",
        "Rosario de la Frontera",
      ],
      "entre rios": [
        "Paraná",
        "Concordia",
        "Gualeguaychú",
        "Concepción del Uruguay",
        "Villaguay",
        "Federación",
        "Victoria",
        "Colón",
        "Chajarí",
      ],
      misiones: [
        "Posadas",
        "Oberá",
        "Eldorado",
        "Puerto Iguazú",
        "Apóstoles",
        "San Vicente",
        "Jardín América",
        "Leandro N. Alem",
      ],
      chaco: [
        "Resistencia",
        "Presidencia Roque Sáenz Peña",
        "Villa Ángela",
        "General San Martín",
        "Charata",
        "Las Breñas",
      ],
      corrientes: [
        "Corrientes Capital",
        "Goya",
        "Paso de los Libres",
        "Mercedes",
        "Curuzú Cuatiá",
        "Bella Vista",
        "Monte Caseros",
      ],
      neuquen: [
        "Neuquén Capital",
        "San Martín de los Andes",
        "Cutral Co",
        "Zapala",
        "Centenario",
        "Plottier",
        "Villa La Angostura",
      ],
      "rio negro": [
        "Viedma",
        "San Carlos de Bariloche",
        "General Roca",
        "Cipolletti",
        "Allen",
        "Villa Regina",
        "El Bolsón",
      ],
      chubut: [
        "Rawson",
        "Comodoro Rivadavia",
        "Trelew",
        "Puerto Madryn",
        "Esquel",
        "Sarmiento",
      ],
      jujuy: [
        "San Salvador de Jujuy",
        "San Pedro de Jujuy",
        "Libertador General San Martín",
        "Palpalá",
        "Humahuaca",
        "Tilcara",
      ],
      "san juan": [
        "San Juan Capital",
        "Rawson",
        "Rivadavia",
        "Chimbas",
        "Santa Lucía",
        "Pocito",
        "Caucete",
      ],
      "san luis": [
        "San Luis Capital",
        "Villa Mercedes",
        "Merlo",
        "La Punta",
        "Juana Koslay",
      ],
      catamarca: [
        "San Fernando del Valle de Catamarca",
        "Tinogasta",
        "Andalgalá",
        "Santa María",
      ],
      "la rioja": ["La Rioja Capital", "Chilecito", "Aimogasta"],
      formosa: ["Formosa Capital", "Clorinda", "Pirané", "El Colorado"],
      "la pampa": ["Santa Rosa", "General Pico", "Toay", "Realicó"],
      "santa cruz": [
        "Río Gallegos",
        "Caleta Olivia",
        "El Calafate",
        "Pico Truncado",
        "Puerto Deseado",
      ],
      "tierra del fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
      "santiago del estero": [
        "Santiago del Estero Capital",
        "La Banda",
        "Termas de Río Hondo",
        "Añatuya",
        "Frías",
      ],
    };

    // Detectar qué provincia es
    let cities: string[] = [];
    for (const [prov, provCities] of Object.entries(provinceCities)) {
      if (normalized.includes(prov)) {
        cities = provCities;
        break;
      }
    }

    // Si no encontramos ciudades específicas, usar una estrategia genérica
    if (cities.length === 0) {
      // Usar variaciones con puntos cardinales y términos genéricos
      return this.generateSearchVariations(keyword, location, maxCities);
    }

    // Limitar a maxCities ciudades
    const citiesToSearch = cities.slice(0, maxCities);

    // Generar URLs para cada ciudad
    for (const city of citiesToSearch) {
      variations.push({
        url: `https://www.google.com/maps/search/${encodeURIComponent(
          `${keyword} en ${city}`
        )}`,
        label: city,
        variation: city,
      });
    }

    return variations;
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
