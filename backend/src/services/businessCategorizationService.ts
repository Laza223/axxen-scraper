/**
 * 🏷️ BUSINESS CATEGORIZATION SERVICE
 *
 * Servicio genérico para categorizar automáticamente negocios.
 * Detecta: tipo de negocio, tamaño (franquicia/local/independiente),
 * y otras características relevantes.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface BusinessProfile {
  name: string;
  category?: string;
  address?: string;
  website?: string;
  phone?: string;
  reviewCount?: number;
  rating?: number;
  hasMultipleLocations?: boolean;
  chainName?: string;
}

export interface CategorizationResult {
  // Tipo de negocio detectado
  businessType: string;
  businessTypeConfidence: number; // 0-100

  // Tamaño/escala del negocio
  businessSize: "franchise" | "chain" | "local" | "independent" | "unknown";
  businessSizeConfidence: number;

  // Si es franquicia/cadena, nombre de la cadena
  chainName?: string;

  // Segmento de mercado
  marketSegment: "premium" | "standard" | "budget" | "unknown";

  // Características detectadas
  characteristics: string[];

  // Score de confianza general
  overallConfidence: number;
}

// ============================================================================
// BASES DE DATOS DE CATEGORIZACIÓN
// ============================================================================

// Franquicias y cadenas conocidas (genéricas, no solo un rubro)
const KNOWN_FRANCHISES: Record<string, { type: string; segment: string }> = {
  // Inmobiliarias
  "re/max": { type: "inmobiliaria", segment: "premium" },
  remax: { type: "inmobiliaria", segment: "premium" },
  "century 21": { type: "inmobiliaria", segment: "premium" },
  century21: { type: "inmobiliaria", segment: "premium" },
  coldwell: { type: "inmobiliaria", segment: "premium" },
  keller: { type: "inmobiliaria", segment: "premium" },
  sothebys: { type: "inmobiliaria", segment: "premium" },

  // Gastronomía
  mcdonalds: { type: "fast_food", segment: "standard" },
  "mcdonald's": { type: "fast_food", segment: "standard" },
  "burger king": { type: "fast_food", segment: "standard" },
  wendys: { type: "fast_food", segment: "standard" },
  starbucks: { type: "cafeteria", segment: "premium" },
  mostaza: { type: "fast_food", segment: "standard" },
  subway: { type: "fast_food", segment: "standard" },
  "pizza hut": { type: "pizzeria", segment: "standard" },
  "papa johns": { type: "pizzeria", segment: "standard" },
  "kentucky fried": { type: "fast_food", segment: "standard" },
  kfc: { type: "fast_food", segment: "standard" },
  havanna: { type: "cafeteria", segment: "premium" },

  // Gimnasios
  "smart fit": { type: "gimnasio", segment: "budget" },
  smartfit: { type: "gimnasio", segment: "budget" },
  megatlon: { type: "gimnasio", segment: "premium" },
  sportclub: { type: "gimnasio", segment: "standard" },
  crossfit: { type: "gimnasio", segment: "premium" },
  "planet fitness": { type: "gimnasio", segment: "budget" },

  // Retail
  carrefour: { type: "supermercado", segment: "standard" },
  walmart: { type: "supermercado", segment: "budget" },
  coto: { type: "supermercado", segment: "standard" },
  dia: { type: "supermercado", segment: "budget" },
  jumbo: { type: "supermercado", segment: "premium" },

  // Farmacias
  farmacity: { type: "farmacia", segment: "premium" },
  "dr. ahorro": { type: "farmacia", segment: "budget" },
  "farmacias del pueblo": { type: "farmacia", segment: "budget" },

  // Automotoras
  toyota: { type: "concesionario", segment: "standard" },
  ford: { type: "concesionario", segment: "standard" },
  chevrolet: { type: "concesionario", segment: "standard" },
  volkswagen: { type: "concesionario", segment: "standard" },
  fiat: { type: "concesionario", segment: "standard" },
  renault: { type: "concesionario", segment: "standard" },
  peugeot: { type: "concesionario", segment: "standard" },
  mercedes: { type: "concesionario", segment: "premium" },
  bmw: { type: "concesionario", segment: "premium" },
  audi: { type: "concesionario", segment: "premium" },

  // Bancos
  santander: { type: "banco", segment: "standard" },
  galicia: { type: "banco", segment: "standard" },
  bbva: { type: "banco", segment: "standard" },
  hsbc: { type: "banco", segment: "premium" },
  macro: { type: "banco", segment: "standard" },
  nacion: { type: "banco", segment: "standard" },

  // Telecomunicaciones
  movistar: { type: "telecomunicaciones", segment: "standard" },
  personal: { type: "telecomunicaciones", segment: "standard" },
  claro: { type: "telecomunicaciones", segment: "standard" },

  // Construcción/Materiales
  easy: { type: "materiales_construccion", segment: "standard" },
  sodimac: { type: "materiales_construccion", segment: "standard" },
  "home depot": { type: "materiales_construccion", segment: "standard" },
};

// Indicadores de negocio local/independiente
const LOCAL_INDICATORS = [
  "de la familia",
  "familiar",
  "hermanos",
  "e hijos",
  "e hijo",
  "y asociados",
  "& asociados",
  "consultora",
  "consultoría",
  "estudio",
  "taller",
  "artesanal",
  "casero",
  "local",
];

// Indicadores de negocio premium
const PREMIUM_INDICATORS = [
  "premium",
  "luxury",
  "exclusive",
  "boutique",
  "vip",
  "gold",
  "platinum",
  "elite",
  "first class",
  "deluxe",
  "gourmet",
  "design",
  "concept",
];

// Indicadores de negocio económico
const BUDGET_INDICATORS = [
  "express",
  "económico",
  "barato",
  "low cost",
  "popular",
  "descuento",
  "outlet",
  "mayorista",
  "todo x",
  "todo por",
  "$",
  "1000",
  "2000",
];

// Palabras clave por tipo de negocio (genérico)
const BUSINESS_TYPE_KEYWORDS: Record<string, string[]> = {
  inmobiliaria: [
    "inmobiliaria",
    "propiedades",
    "bienes raices",
    "real estate",
    "alquileres",
    "broker",
  ],
  constructora: [
    "constructora",
    "construcciones",
    "obras",
    "edificaciones",
    "desarrollos",
  ],
  restaurante: [
    "restaurante",
    "restaurant",
    "resto",
    "parrilla",
    "grill",
    "cocina",
  ],
  pizzeria: ["pizzeria", "pizza", "pizzas"],
  cafeteria: ["cafe", "cafetería", "coffee", "bar de cafe"],
  fast_food: [
    "hamburguesas",
    "comida rapida",
    "fast food",
    "delivery",
    "take away",
  ],
  peluqueria: ["peluqueria", "barberia", "salon", "hair", "estilista"],
  gimnasio: ["gimnasio", "gym", "fitness", "crossfit", "training", "deportivo"],
  dentista: ["dental", "odontologia", "dentista", "odontologo"],
  medico: ["medico", "clinica", "consultorio", "hospital", "sanatorio"],
  veterinaria: ["veterinaria", "pet", "mascotas", "animales"],
  abogado: ["abogado", "estudio juridico", "bufete", "legal"],
  contador: ["contador", "contable", "contaduria", "estudio contable"],
  automotora: ["autos", "automotora", "concesionario", "vehiculos", "car"],
  mecanico: ["mecanico", "taller", "service", "reparacion autos"],
  farmacia: ["farmacia", "drogueria", "medicamentos"],
  supermercado: ["supermercado", "super", "almacen", "despensa"],
  ferreteria: ["ferreteria", "herramientas", "materiales"],
  electricista: ["electricista", "electrico", "instalaciones electricas"],
  plomero: ["plomero", "plomeria", "gasista", "sanitarios"],
  cerrajeria: ["cerrajeria", "cerrajero", "llaves"],
  limpieza: ["limpieza", "cleaning", "mantenimiento"],
  seguridad: ["seguridad", "vigilancia", "alarmas", "camaras"],
  tecnologia: ["software", "sistemas", "it", "informatica", "desarrollo"],
  marketing: ["marketing", "publicidad", "agencia digital", "redes sociales"],
  fotografia: ["fotografia", "fotografo", "estudio fotografico", "video"],
  eventos: ["eventos", "catering", "fiestas", "salon de eventos"],
  educacion: ["escuela", "colegio", "instituto", "academia", "cursos"],
  hotel: ["hotel", "hospedaje", "alojamiento", "hostel"],
  mudanza: ["mudanzas", "fletes", "transporte", "logistica"],
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class BusinessCategorizationService {
  /**
   * Categoriza un negocio basado en su información
   */
  categorize(business: BusinessProfile): CategorizationResult {
    const normalizedName = this.normalizeText(business.name);
    const normalizedCategory = this.normalizeText(business.category || "");

    // 1. Detectar si es franquicia conocida
    const franchiseInfo = this.detectFranchise(normalizedName);

    // 2. Detectar tipo de negocio
    const businessType = this.detectBusinessType(
      normalizedName,
      normalizedCategory
    );

    // 3. Detectar tamaño del negocio
    const businessSize = this.detectBusinessSize(business, franchiseInfo);

    // 4. Detectar segmento de mercado
    const marketSegment = this.detectMarketSegment(business, franchiseInfo);

    // 5. Detectar características
    const characteristics = this.detectCharacteristics(business);

    // Calcular confianza general
    const overallConfidence = this.calculateOverallConfidence(
      businessType.confidence,
      businessSize.confidence,
      franchiseInfo !== null
    );

    return {
      businessType: businessType.type,
      businessTypeConfidence: businessType.confidence,
      businessSize: businessSize.size,
      businessSizeConfidence: businessSize.confidence,
      chainName: franchiseInfo?.chainName,
      marketSegment,
      characteristics,
      overallConfidence,
    };
  }

  /**
   * Detecta si es una franquicia conocida
   */
  private detectFranchise(
    normalizedName: string
  ): { chainName: string; type: string; segment: string } | null {
    for (const [franchise, info] of Object.entries(KNOWN_FRANCHISES)) {
      if (normalizedName.includes(this.normalizeText(franchise))) {
        return {
          chainName: franchise,
          type: info.type,
          segment: info.segment,
        };
      }
    }
    return null;
  }

  /**
   * Detecta el tipo de negocio
   */
  private detectBusinessType(
    normalizedName: string,
    normalizedCategory: string
  ): { type: string; confidence: number } {
    const combined = `${normalizedName} ${normalizedCategory}`;

    let bestMatch = { type: "unknown", confidence: 0 };

    for (const [type, keywords] of Object.entries(BUSINESS_TYPE_KEYWORDS)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (combined.includes(this.normalizeText(keyword))) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(100, matchCount * 30 + 20);
        if (confidence > bestMatch.confidence) {
          bestMatch = { type, confidence };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Detecta el tamaño del negocio
   */
  private detectBusinessSize(
    business: BusinessProfile,
    franchiseInfo: any
  ): { size: CategorizationResult["businessSize"]; confidence: number } {
    // Si es franquicia conocida
    if (franchiseInfo) {
      return { size: "franchise", confidence: 95 };
    }

    const normalizedName = this.normalizeText(business.name);

    // Detectar indicadores de cadena
    if (
      business.hasMultipleLocations ||
      normalizedName.includes("sucursal") ||
      normalizedName.includes("sede")
    ) {
      return { size: "chain", confidence: 70 };
    }

    // Detectar indicadores de negocio local
    for (const indicator of LOCAL_INDICATORS) {
      if (normalizedName.includes(this.normalizeText(indicator))) {
        return { size: "local", confidence: 75 };
      }
    }

    // Inferir por cantidad de reseñas
    const reviews = business.reviewCount || 0;
    if (reviews > 500) {
      return { size: "chain", confidence: 60 };
    } else if (reviews > 100) {
      return { size: "local", confidence: 50 };
    } else if (reviews > 10) {
      return { size: "independent", confidence: 60 };
    }

    return { size: "unknown", confidence: 30 };
  }

  /**
   * Detecta el segmento de mercado
   */
  private detectMarketSegment(
    business: BusinessProfile,
    franchiseInfo: any
  ): CategorizationResult["marketSegment"] {
    // Si es franquicia, usar su segmento
    if (franchiseInfo) {
      return franchiseInfo.segment as CategorizationResult["marketSegment"];
    }

    const normalizedName = this.normalizeText(business.name);

    // Detectar indicadores premium
    for (const indicator of PREMIUM_INDICATORS) {
      if (normalizedName.includes(this.normalizeText(indicator))) {
        return "premium";
      }
    }

    // Detectar indicadores budget
    for (const indicator of BUDGET_INDICATORS) {
      if (normalizedName.includes(this.normalizeText(indicator))) {
        return "budget";
      }
    }

    // Inferir por rating
    const rating = business.rating || 0;
    if (rating >= 4.5) {
      return "premium";
    } else if (rating >= 3.5) {
      return "standard";
    } else if (rating > 0) {
      return "budget";
    }

    return "unknown";
  }

  /**
   * Detecta características adicionales
   */
  private detectCharacteristics(business: BusinessProfile): string[] {
    const characteristics: string[] = [];
    const normalizedName = this.normalizeText(business.name);

    // Negocio familiar
    if (
      normalizedName.includes("familia") ||
      normalizedName.includes("hermanos") ||
      normalizedName.includes("hijos")
    ) {
      characteristics.push("negocio_familiar");
    }

    // Negocio asociado/estudio
    if (
      normalizedName.includes("asociados") ||
      normalizedName.includes("estudio")
    ) {
      characteristics.push("estudio_profesional");
    }

    // Tiene website
    if (business.website) {
      characteristics.push("presencia_digital");
    }

    // Bien calificado
    if ((business.rating || 0) >= 4.5) {
      characteristics.push("alta_calificacion");
    }

    // Muchas reseñas
    if ((business.reviewCount || 0) > 100) {
      characteristics.push("establecido");
    }

    // Pocas reseñas (posiblemente nuevo)
    if ((business.reviewCount || 0) < 5) {
      characteristics.push("posiblemente_nuevo");
    }

    return characteristics;
  }

  /**
   * Calcula confianza general
   */
  private calculateOverallConfidence(
    typeConfidence: number,
    sizeConfidence: number,
    isFranchise: boolean
  ): number {
    if (isFranchise) {
      return Math.round((typeConfidence + sizeConfidence + 100) / 3);
    }
    return Math.round((typeConfidence + sizeConfidence) / 2);
  }

  /**
   * Normaliza texto para comparaciones
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  /**
   * Categoriza múltiples negocios
   */
  categorizeMany(businesses: BusinessProfile[]): CategorizationResult[] {
    return businesses.map((b) => this.categorize(b));
  }

  /**
   * Agrupa negocios por tipo
   */
  groupByType(
    businesses: BusinessProfile[]
  ): Record<string, BusinessProfile[]> {
    const groups: Record<string, BusinessProfile[]> = {};

    for (const business of businesses) {
      const result = this.categorize(business);
      const type = result.businessType;

      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(business);
    }

    return groups;
  }

  /**
   * Agrupa negocios por tamaño
   */
  groupBySize(
    businesses: BusinessProfile[]
  ): Record<CategorizationResult["businessSize"], BusinessProfile[]> {
    const groups: Record<
      CategorizationResult["businessSize"],
      BusinessProfile[]
    > = {
      franchise: [],
      chain: [],
      local: [],
      independent: [],
      unknown: [],
    };

    for (const business of businesses) {
      const result = this.categorize(business);
      groups[result.businessSize].push(business);
    }

    return groups;
  }

  /**
   * Filtra solo negocios locales/independientes (excluye franquicias)
   */
  filterLocalOnly(businesses: BusinessProfile[]): BusinessProfile[] {
    return businesses.filter((b) => {
      const result = this.categorize(b);
      return (
        result.businessSize === "local" || result.businessSize === "independent"
      );
    });
  }

  /**
   * Filtra solo franquicias/cadenas
   */
  filterFranchisesOnly(businesses: BusinessProfile[]): BusinessProfile[] {
    return businesses.filter((b) => {
      const result = this.categorize(b);
      return (
        result.businessSize === "franchise" || result.businessSize === "chain"
      );
    });
  }
}

export default new BusinessCategorizationService();
