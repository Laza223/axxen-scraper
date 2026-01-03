/**
 * 🔄 SYNONYM SERVICE - Generación de Sinónimos para Búsquedas
 *
 * Servicio GENÉRICO que expande cualquier término de búsqueda
 * con sinónimos relevantes para aumentar la cobertura.
 *
 * NO está limitado a un tipo de negocio específico.
 */

import logger from "./logger";

// ============================================================================
// DICCIONARIO DE SINÓNIMOS POR CATEGORÍA DE NEGOCIO
// ============================================================================

/**
 * Diccionario de sinónimos organizados por categoría.
 * Cada entrada tiene:
 * - keywords: palabras clave que activan esta categoría
 * - synonyms: variantes y sinónimos para buscar
 */
const SYNONYM_DICTIONARY: Record<
  string,
  { keywords: string[]; synonyms: string[] }
> = {
  // 🏠 INMOBILIARIAS
  inmobiliaria: {
    keywords: ["inmobiliaria", "inmobiliarias", "real estate", "bienes raices"],
    synonyms: [
      "inmobiliaria",
      "agente inmobiliario",
      "corredor inmobiliario",
      "bienes raíces",
      "propiedades",
      "venta de casas",
      "alquiler departamentos",
      "broker inmobiliario",
    ],
  },

  // 🏗️ CONSTRUCCIÓN
  construccion: {
    keywords: [
      "construccion",
      "constructora",
      "constructor",
      "construcción",
      "building",
    ],
    synonyms: [
      "constructora",
      "empresa de construcción",
      "construcciones",
      "contratista",
      "obras civiles",
      "reformas",
      "remodelaciones",
      "arquitecto constructor",
      "maestro mayor de obras",
      "albañilería",
    ],
  },

  // ✂️ PELUQUERÍAS Y BELLEZA
  peluqueria: {
    keywords: ["peluqueria", "peluquería", "barberia", "salon", "hair"],
    synonyms: [
      "peluquería",
      "barbería",
      "salon de belleza",
      "estilista",
      "hair salon",
      "corte de pelo",
      "peluquero",
      "barbershop",
      "centro de estética capilar",
    ],
  },

  // 🍽️ RESTAURANTES Y GASTRONOMÍA
  restaurante: {
    keywords: ["restaurante", "restaurant", "comida", "gastronomia", "food"],
    synonyms: [
      "restaurante",
      "restaurant",
      "parrilla",
      "pizzería",
      "cafetería",
      "bar",
      "bodegón",
      "resto bar",
      "comedor",
      "cocina",
      "rotisería",
    ],
  },

  // 🦷 ODONTOLOGÍA
  dentista: {
    keywords: ["dentista", "odontologia", "dental", "odontólogo"],
    synonyms: [
      "dentista",
      "odontólogo",
      "clínica dental",
      "consultorio odontológico",
      "centro dental",
      "implantes dentales",
      "ortodoncia",
    ],
  },

  // ⚖️ ABOGADOS
  abogado: {
    keywords: ["abogado", "abogados", "legal", "juridico", "lawyer"],
    synonyms: [
      "abogado",
      "estudio jurídico",
      "bufete de abogados",
      "asesor legal",
      "consultoría legal",
      "abogacía",
      "despacho de abogados",
    ],
  },

  // 🐕 VETERINARIAS
  veterinaria: {
    keywords: ["veterinaria", "veterinario", "mascotas", "pet", "animal"],
    synonyms: [
      "veterinaria",
      "clínica veterinaria",
      "hospital veterinario",
      "pet shop",
      "tienda de mascotas",
      "centro veterinario",
    ],
  },

  // 💪 GIMNASIOS Y FITNESS
  gimnasio: {
    keywords: ["gimnasio", "gym", "fitness", "crossfit", "entrenamiento"],
    synonyms: [
      "gimnasio",
      "gym",
      "centro de fitness",
      "crossfit",
      "box de crossfit",
      "pilates",
      "yoga",
      "centro deportivo",
      "club fitness",
    ],
  },

  // 🧮 CONTADORES
  contador: {
    keywords: [
      "contador",
      "contadora",
      "contable",
      "contabilidad",
      "accountant",
    ],
    synonyms: [
      "contador público",
      "estudio contable",
      "contaduría",
      "asesor contable",
      "servicios contables",
      "consultoría contable",
    ],
  },

  // 🏥 MÉDICOS Y CLÍNICAS
  medico: {
    keywords: ["medico", "médico", "doctor", "clinica", "salud", "health"],
    synonyms: [
      "médico",
      "clínica",
      "consultorio médico",
      "centro médico",
      "especialista",
      "doctor",
      "sanatorio",
    ],
  },

  // 💆 ESTÉTICA Y SPA
  estetica: {
    keywords: ["estetica", "estética", "spa", "belleza", "beauty"],
    synonyms: [
      "centro de estética",
      "spa",
      "tratamientos faciales",
      "depilación",
      "masajes",
      "clínica estética",
      "medicina estética",
    ],
  },

  // 🚗 AUTOMOTORAS
  automotora: {
    keywords: ["automotora", "autos", "concesionario", "cars", "vehiculos"],
    synonyms: [
      "automotora",
      "concesionario",
      "agencia de autos",
      "venta de autos",
      "compra venta automotor",
      "car dealer",
      "autos usados",
    ],
  },

  // 🔧 MECÁNICOS
  mecanico: {
    keywords: ["mecanico", "mecánico", "taller", "garage", "automotriz"],
    synonyms: [
      "taller mecánico",
      "mecánico automotriz",
      "service automotor",
      "taller de autos",
      "reparación de autos",
      "garage",
    ],
  },

  // 🏨 HOTELES Y ALOJAMIENTO
  hotel: {
    keywords: ["hotel", "hospedaje", "alojamiento", "hostel", "lodging"],
    synonyms: [
      "hotel",
      "apart hotel",
      "hostel",
      "alojamiento",
      "hospedaje",
      "posada",
      "cabaña",
      "bed and breakfast",
    ],
  },

  // 📚 EDUCACIÓN
  educacion: {
    keywords: [
      "escuela",
      "colegio",
      "instituto",
      "academia",
      "educacion",
      "school",
    ],
    synonyms: [
      "escuela",
      "colegio",
      "instituto",
      "academia",
      "centro educativo",
      "cursos",
      "capacitación",
      "formación",
    ],
  },

  // 🖥️ TECNOLOGÍA
  tecnologia: {
    keywords: [
      "tecnologia",
      "software",
      "it",
      "desarrollo",
      "tech",
      "sistemas",
    ],
    synonyms: [
      "empresa de software",
      "desarrollo de sistemas",
      "consultoría IT",
      "servicios informáticos",
      "tecnología",
      "soporte técnico",
      "programación",
    ],
  },

  // 📦 MUDANZAS Y FLETES
  mudanza: {
    keywords: ["mudanza", "flete", "transporte", "moving"],
    synonyms: [
      "mudanzas",
      "fletes",
      "transporte de carga",
      "logística",
      "traslados",
      "envíos",
    ],
  },

  // 🔒 CERRAJERÍA
  cerrajeria: {
    keywords: ["cerrajeria", "cerrajero", "llaves", "locksmith"],
    synonyms: [
      "cerrajería",
      "cerrajero",
      "cerraduras",
      "llaves",
      "apertura de puertas",
      "locksmith",
    ],
  },

  // ⚡ ELECTRICISTAS
  electricista: {
    keywords: ["electricista", "electrico", "electrical", "instalaciones"],
    synonyms: [
      "electricista",
      "instalaciones eléctricas",
      "electricidad",
      "técnico electricista",
      "reparaciones eléctricas",
    ],
  },

  // 🔧 PLOMERÍA
  plomero: {
    keywords: ["plomero", "plomeria", "gasista", "plumber"],
    synonyms: [
      "plomero",
      "plomería",
      "gasista",
      "instalaciones sanitarias",
      "destapaciones",
      "cañerías",
    ],
  },

  // 🎨 DISEÑO
  diseno: {
    keywords: ["diseño", "design", "grafico", "diseñador"],
    synonyms: [
      "diseño gráfico",
      "agencia de diseño",
      "diseñador",
      "estudio de diseño",
      "branding",
      "diseño web",
    ],
  },

  // 📱 MARKETING
  marketing: {
    keywords: ["marketing", "publicidad", "advertising", "digital"],
    synonyms: [
      "agencia de marketing",
      "publicidad",
      "marketing digital",
      "community manager",
      "redes sociales",
      "advertising",
    ],
  },

  // 📷 FOTOGRAFÍA
  fotografia: {
    keywords: ["fotografia", "fotografo", "photography", "foto"],
    synonyms: [
      "fotógrafo",
      "estudio fotográfico",
      "fotografía",
      "video",
      "producción audiovisual",
      "eventos",
    ],
  },

  // 🎉 EVENTOS
  eventos: {
    keywords: ["eventos", "catering", "fiestas", "event", "organizador"],
    synonyms: [
      "organizador de eventos",
      "catering",
      "salón de fiestas",
      "eventos corporativos",
      "wedding planner",
      "decoración de eventos",
    ],
  },

  // 🧹 LIMPIEZA
  limpieza: {
    keywords: ["limpieza", "cleaning", "mantenimiento"],
    synonyms: [
      "empresa de limpieza",
      "limpieza industrial",
      "mantenimiento",
      "aseo",
      "servicios de limpieza",
    ],
  },

  // 🛡️ SEGURIDAD
  seguridad: {
    keywords: ["seguridad", "vigilancia", "security", "alarmas"],
    synonyms: [
      "empresa de seguridad",
      "vigilancia",
      "alarmas",
      "monitoreo",
      "cámaras de seguridad",
      "seguridad privada",
    ],
  },
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class SynonymService {
  /**
   * Detecta la categoría de un término de búsqueda
   */
  detectCategory(searchTerm: string): string | null {
    const normalizedTerm = this.normalizeText(searchTerm);

    for (const [category, data] of Object.entries(SYNONYM_DICTIONARY)) {
      for (const keyword of data.keywords) {
        if (normalizedTerm.includes(this.normalizeText(keyword))) {
          return category;
        }
      }
    }

    return null;
  }

  /**
   * Obtiene sinónimos para un término de búsqueda
   * Retorna array de términos alternativos para buscar
   */
  getSynonyms(searchTerm: string): string[] {
    const category = this.detectCategory(searchTerm);

    if (!category) {
      logger.debug(`🔄 No se encontraron sinónimos para: ${searchTerm}`);
      return [searchTerm]; // Retorna solo el término original
    }

    const synonyms = SYNONYM_DICTIONARY[category].synonyms;
    logger.info(
      `🔄 Categoría detectada: ${category} - ${synonyms.length} sinónimos`
    );

    return synonyms;
  }

  /**
   * Genera múltiples búsquedas expandidas con sinónimos
   * Para una búsqueda como "inmobiliarias en Moreno" genera:
   * - "inmobiliaria en Moreno"
   * - "agente inmobiliario en Moreno"
   * - etc.
   */
  expandSearchWithSynonyms(
    keyword: string,
    location: string,
    maxVariants: number = 5
  ): string[] {
    const synonyms = this.getSynonyms(keyword);

    // Limitar cantidad de variantes
    const limitedSynonyms = synonyms.slice(0, maxVariants);

    // Generar búsquedas con ubicación
    const searches = limitedSynonyms.map(
      (synonym) => `${synonym} en ${location}`
    );

    logger.info(`🔍 Búsquedas expandidas: ${searches.length} variantes`);
    return searches;
  }

  /**
   * Verifica si un resultado es relevante para la búsqueda original
   */
  isRelevantResult(
    resultCategory: string,
    resultName: string,
    originalSearch: string
  ): { relevant: boolean; score: number } {
    const normalizedCategory = this.normalizeText(resultCategory);
    const normalizedName = this.normalizeText(resultName);
    const normalizedSearch = this.normalizeText(originalSearch);

    // Detectar categoría del search
    const searchCategory = this.detectCategory(originalSearch);

    if (!searchCategory) {
      // Sin categoría detectada, verificación básica
      const basicMatch =
        normalizedCategory.includes(normalizedSearch) ||
        normalizedName.includes(normalizedSearch);
      return { relevant: basicMatch, score: basicMatch ? 50 : 0 };
    }

    // Obtener todas las palabras clave de la categoría
    const categoryData = SYNONYM_DICTIONARY[searchCategory];
    const allKeywords = [
      ...categoryData.keywords,
      ...categoryData.synonyms.flatMap((s) => s.split(" ")),
    ];

    // Contar cuántas palabras clave coinciden
    let matchCount = 0;
    for (const keyword of allKeywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (
        normalizedCategory.includes(normalizedKeyword) ||
        normalizedName.includes(normalizedKeyword)
      ) {
        matchCount++;
      }
    }

    // Score basado en cantidad de matches
    const score = Math.min(100, matchCount * 20);
    const relevant = matchCount > 0;

    return { relevant, score };
  }

  /**
   * Normaliza texto para comparaciones (quita acentos, lowercase, etc.)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9\s]/g, "") // Solo letras, números y espacios
      .trim();
  }

  /**
   * Agrega una nueva categoría con sinónimos al diccionario
   * Útil para expandir dinámicamente
   */
  addCategory(
    categoryName: string,
    keywords: string[],
    synonyms: string[]
  ): void {
    SYNONYM_DICTIONARY[categoryName] = { keywords, synonyms };
    logger.info(`📚 Nueva categoría agregada: ${categoryName}`);
  }

  /**
   * Lista todas las categorías disponibles
   */
  listCategories(): string[] {
    return Object.keys(SYNONYM_DICTIONARY);
  }

  /**
   * Obtiene información de una categoría
   */
  getCategoryInfo(
    category: string
  ): { keywords: string[]; synonyms: string[] } | null {
    return SYNONYM_DICTIONARY[category] || null;
  }
}

export default new SynonymService();
