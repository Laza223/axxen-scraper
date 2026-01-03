/**
 * 🔄 SYNONYM SERVICE - Generación de Sinónimos para Búsquedas
 *
 * Servicio GENÉRICO que expande cualquier término de búsqueda
 * con sinónimos relevantes para aumentar la cobertura.
 *
 * NO está limitado a un tipo de negocio específico.
 *
 * 🆕 OPTIMIZADO: Cada categoría tiene máximo 8 sinónimos MUY DISTINTOS
 * para evitar duplicados masivos entre búsquedas.
 */

import logger from "./logger";

// ============================================================================
// DICCIONARIO DE SINÓNIMOS POR CATEGORÍA DE NEGOCIO
// ============================================================================

/**
 * Diccionario de sinónimos organizados por categoría.
 * Cada entrada tiene:
 * - keywords: palabras clave que activan esta categoría
 * - synonyms: variantes DISTINTAS para buscar (máximo 8)
 */
const SYNONYM_DICTIONARY: Record<
  string,
  { keywords: string[]; synonyms: string[] }
> = {
  // 🏠 INMOBILIARIAS
  inmobiliaria: {
    keywords: [
      "inmobiliaria",
      "inmobiliarias",
      "real estate",
      "bienes raices",
      "propiedades",
    ],
    synonyms: [
      "inmobiliaria",
      "agente inmobiliario",
      "corredor de propiedades",
      "tasador inmobiliario",
      "administración de alquileres",
      "desarrollador inmobiliario",
      "martillero público",
      "inversiones inmobiliarias",
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
      "obra",
      "obras",
    ],
    synonyms: [
      "constructora",
      "empresa de construcción",
      "contratista obras",
      "maestro mayor de obras",
      "corralón materiales",
      "ingeniería civil",
      "reformas y remodelaciones",
      "albañilería profesional",
    ],
  },

  // ✂️ PELUQUERÍAS Y BELLEZA
  peluqueria: {
    keywords: [
      "peluqueria",
      "peluquería",
      "barberia",
      "salon",
      "hair",
      "corte",
    ],
    synonyms: [
      "peluquería unisex",
      "barbería tradicional",
      "salon de belleza",
      "estilista profesional",
      "colorimetría capilar",
      "tratamientos capilares",
      "alisado permanente",
      "extensiones de cabello",
    ],
  },

  // 🍽️ RESTAURANTES Y GASTRONOMÍA
  restaurante: {
    keywords: [
      "restaurante",
      "restaurant",
      "comida",
      "gastronomia",
      "food",
      "comer",
    ],
    synonyms: [
      "restaurante",
      "parrilla argentina",
      "pizzería artesanal",
      "cafetería gourmet",
      "resto bar",
      "cocina internacional",
      "delivery comida",
      "catering eventos",
    ],
  },

  // 🦷 ODONTOLOGÍA
  dentista: {
    keywords: ["dentista", "odontologia", "dental", "odontólogo", "dientes"],
    synonyms: [
      "clínica dental",
      "odontólogo especialista",
      "implantes dentales",
      "ortodoncia brackets",
      "blanqueamiento dental",
      "endodoncia",
      "prótesis dentales",
      "odontopediatría",
    ],
  },

  // ⚖️ ABOGADOS
  abogado: {
    keywords: ["abogado", "abogados", "legal", "juridico", "lawyer", "derecho"],
    synonyms: [
      "estudio jurídico",
      "abogado civil",
      "abogado penalista",
      "abogado laboral",
      "abogado de familia",
      "escribanía",
      "mediación y arbitraje",
      "asesoría legal empresas",
    ],
  },

  // 🐕 VETERINARIAS
  veterinaria: {
    keywords: [
      "veterinaria",
      "veterinario",
      "mascotas",
      "pet",
      "animal",
      "perros",
      "gatos",
    ],
    synonyms: [
      "veterinaria 24 horas",
      "hospital veterinario",
      "pet shop accesorios",
      "peluquería canina",
      "guardería mascotas",
      "adiestramiento canino",
      "vacunación mascotas",
      "cirugía veterinaria",
    ],
  },

  // 💪 GIMNASIOS Y FITNESS
  gimnasio: {
    keywords: [
      "gimnasio",
      "gym",
      "fitness",
      "crossfit",
      "entrenamiento",
      "musculacion",
    ],
    synonyms: [
      "gimnasio musculación",
      "crossfit box",
      "pilates reformer",
      "yoga studio",
      "entrenador personal",
      "spinning cycling",
      "artes marciales",
      "natación club",
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
      "impuestos",
    ],
    synonyms: [
      "contador público certificado",
      "estudio contable",
      "liquidación de sueldos",
      "monotributo asesor",
      "auditoría contable",
      "consultoría impositiva",
      "balances y DDJJ",
      "outsourcing contable",
    ],
  },

  // 🏥 MÉDICOS Y CLÍNICAS
  medico: {
    keywords: [
      "medico",
      "médico",
      "doctor",
      "clinica",
      "salud",
      "health",
      "consultorio",
    ],
    synonyms: [
      "clínica médica",
      "médico clínico",
      "pediatra infantil",
      "ginecólogo obstetra",
      "cardiólogo",
      "dermatólogo",
      "traumatólogo",
      "laboratorio análisis",
    ],
  },

  // 💆 ESTÉTICA Y SPA
  estetica: {
    keywords: ["estetica", "estética", "spa", "belleza", "beauty", "facial"],
    synonyms: [
      "centro de estética",
      "spa day masajes",
      "depilación definitiva",
      "tratamientos faciales",
      "medicina estética",
      "uñas esculpidas",
      "microblading cejas",
      "dermapen microneedling",
    ],
  },

  // 🚗 AUTOMOTORAS Y AUTOS
  automotora: {
    keywords: [
      "automotora",
      "autos",
      "concesionario",
      "cars",
      "vehiculos",
      "auto",
      "vehículo",
    ],
    synonyms: [
      "concesionario oficial",
      "autos usados garantía",
      "plan de ahorro autos",
      "agencia automotor",
      "compra venta permutas",
      "financiación automotor",
      "leasing vehicular",
      "rent a car alquiler",
    ],
  },

  // 🔧 MECÁNICOS
  mecanico: {
    keywords: [
      "mecanico",
      "mecánico",
      "taller",
      "garage",
      "automotriz",
      "service",
    ],
    synonyms: [
      "taller mecánico",
      "service automotor",
      "alineación balanceo",
      "cambio de aceite",
      "frenos y embrague",
      "electricidad automotor",
      "scanner diagnóstico",
      "aire acondicionado auto",
    ],
  },

  // 🏨 HOTELES Y ALOJAMIENTO
  hotel: {
    keywords: [
      "hotel",
      "hospedaje",
      "alojamiento",
      "hostel",
      "lodging",
      "cabañas",
    ],
    synonyms: [
      "hotel boutique",
      "apart hotel",
      "hostel backpacker",
      "cabañas turísticas",
      "bed and breakfast",
      "alquiler temporario",
      "estancia rural",
      "glamping camping",
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
      "cursos",
    ],
    synonyms: [
      "colegio privado",
      "instituto técnico",
      "academia de idiomas",
      "jardín maternal",
      "universidad privada",
      "apoyo escolar",
      "cursos oficios",
      "capacitación profesional",
    ],
  },

  // 🖥️ TECNOLOGÍA E IT
  tecnologia: {
    keywords: [
      "tecnologia",
      "software",
      "it",
      "desarrollo",
      "tech",
      "sistemas",
      "programacion",
    ],
    synonyms: [
      "desarrollo software",
      "soporte técnico PC",
      "reparación computadoras",
      "redes e infraestructura",
      "ciberseguridad",
      "cloud computing",
      "aplicaciones móviles",
      "consultoría SAP ERP",
    ],
  },

  // 📦 MUDANZAS Y FLETES
  mudanza: {
    keywords: [
      "mudanza",
      "flete",
      "transporte",
      "moving",
      "fletes",
      "traslado",
    ],
    synonyms: [
      "mudanzas residenciales",
      "fletes y minifletes",
      "transporte de carga",
      "embalaje profesional",
      "guardamuebles",
      "logística empresarial",
      "envíos nacionales",
      "courier express",
    ],
  },

  // 🔒 CERRAJERÍA
  cerrajeria: {
    keywords: ["cerrajeria", "cerrajero", "llaves", "locksmith", "cerraduras"],
    synonyms: [
      "cerrajero 24 horas",
      "apertura de puertas",
      "cerraduras de seguridad",
      "llaves codificadas auto",
      "cajas fuertes",
      "control de acceso",
      "herrajes y picaportes",
      "automatización portones",
    ],
  },

  // ⚡ ELECTRICISTAS
  electricista: {
    keywords: [
      "electricista",
      "electrico",
      "electrical",
      "instalaciones",
      "electricidad",
    ],
    synonyms: [
      "electricista matriculado",
      "instalaciones eléctricas",
      "tableros eléctricos",
      "iluminación LED",
      "domótica hogar",
      "puesta a tierra",
      "emergencias eléctricas 24h",
      "energía solar paneles",
    ],
  },

  // 🔧 PLOMERÍA Y GAS
  plomero: {
    keywords: [
      "plomero",
      "plomeria",
      "gasista",
      "plumber",
      "cañerias",
      "sanitario",
    ],
    synonyms: [
      "plomero gasista",
      "destapaciones cloacas",
      "instalación sanitaria",
      "reparación pérdidas",
      "termotanques calefones",
      "cloaca e instalaciones",
      "bombas de agua",
      "piletas y piscinas",
    ],
  },

  // 🎨 DISEÑO Y CREATIVIDAD
  diseno: {
    keywords: ["diseño", "design", "grafico", "diseñador", "creatividad"],
    synonyms: [
      "diseño gráfico",
      "diseño web responsive",
      "branding identidad",
      "diseño de packaging",
      "diseño de interiores",
      "arquitectura diseño",
      "ilustración digital",
      "animación motion",
    ],
  },

  // 📱 MARKETING Y PUBLICIDAD
  marketing: {
    keywords: [
      "marketing",
      "publicidad",
      "advertising",
      "digital",
      "redes sociales",
    ],
    synonyms: [
      "agencia de marketing",
      "marketing digital",
      "community manager",
      "SEO posicionamiento",
      "publicidad Google Ads",
      "email marketing",
      "influencer marketing",
      "producción contenido",
    ],
  },

  // 📷 FOTOGRAFÍA Y VIDEO
  fotografia: {
    keywords: [
      "fotografia",
      "fotografo",
      "photography",
      "foto",
      "video",
      "audiovisual",
    ],
    synonyms: [
      "fotógrafo profesional",
      "fotografía de bodas",
      "video institucional",
      "drone filmación",
      "estudio fotográfico",
      "edición y postproducción",
      "streaming en vivo",
      "fotografía de producto",
    ],
  },

  // 🎉 EVENTOS Y FIESTAS
  eventos: {
    keywords: [
      "eventos",
      "catering",
      "fiestas",
      "event",
      "organizador",
      "cumpleaños",
    ],
    synonyms: [
      "organizador de eventos",
      "catering servicio",
      "salón de fiestas",
      "decoración eventos",
      "DJ sonido iluminación",
      "animación infantil",
      "wedding planner",
      "alquiler carpas gazebos",
    ],
  },

  // 🧹 LIMPIEZA Y MANTENIMIENTO
  limpieza: {
    keywords: ["limpieza", "cleaning", "mantenimiento", "aseo"],
    synonyms: [
      "limpieza de oficinas",
      "limpieza industrial",
      "fumigación control plagas",
      "limpieza de alfombras",
      "limpieza post obra",
      "jardinería paisajismo",
      "piscinas mantenimiento",
      "limpieza de tanques",
    ],
  },

  // 🛡️ SEGURIDAD
  seguridad: {
    keywords: [
      "seguridad",
      "vigilancia",
      "security",
      "alarmas",
      "camaras",
      "monitoreo",
    ],
    synonyms: [
      "alarmas domiciliarias",
      "cámaras CCTV",
      "monitoreo 24 horas",
      "vigilancia privada",
      "control de acceso",
      "cerco eléctrico",
      "custodios eventos",
      "seguridad electrónica",
    ],
  },

  // 🏦 SERVICIOS FINANCIEROS
  finanzas: {
    keywords: [
      "finanzas",
      "credito",
      "prestamo",
      "banco",
      "inversiones",
      "seguros",
    ],
    synonyms: [
      "asesor financiero",
      "préstamos personales",
      "seguros de vida",
      "seguros automotor",
      "broker de seguros",
      "inversiones bursátiles",
      "cambio de divisas",
      "gestoría trámites",
    ],
  },

  // 🏋️ DEPORTES
  deportes: {
    keywords: ["deportes", "futbol", "tenis", "paddle", "cancha", "club"],
    synonyms: [
      "cancha de fútbol 5",
      "cancha de paddle",
      "club deportivo",
      "escuela de tenis",
      "natación clases",
      "running grupos",
      "equipamiento deportivo",
      "suplementos deportivos",
    ],
  },

  // 👶 NIÑOS Y BEBÉS
  bebes: {
    keywords: ["bebes", "niños", "infantil", "baby", "maternidad", "juguetes"],
    synonyms: [
      "tienda de bebés",
      "juguetería",
      "ropa infantil",
      "jardín maternal",
      "cumpleaños infantiles",
      "estimulación temprana",
      "pediatra niños",
      "cochecitos y cunas",
    ],
  },

  // 🎵 MÚSICA Y ARTE
  musica: {
    keywords: ["musica", "música", "instrumento", "clases", "arte", "pintura"],
    synonyms: [
      "escuela de música",
      "clases de guitarra",
      "tienda instrumentos",
      "estudio de grabación",
      "clases de canto",
      "academia de arte",
      "taller de pintura",
      "producción musical",
    ],
  },

  // 🌿 JARDINERÍA Y VIVEROS
  jardineria: {
    keywords: [
      "jardineria",
      "vivero",
      "plantas",
      "paisajismo",
      "cesped",
      "jardin",
    ],
    synonyms: [
      "vivero plantas",
      "jardinería paisajismo",
      "césped y parquización",
      "riego automatizado",
      "poda y mantenimiento",
      "huerta orgánica",
      "flores y arreglos",
      "macetas y decoración",
    ],
  },

  // 🍷 VINOS Y BEBIDAS
  vinos: {
    keywords: [
      "vinos",
      "vinoteca",
      "bodega",
      "cerveza artesanal",
      "bebidas",
      "licores",
    ],
    synonyms: [
      "vinoteca selección",
      "bodega vinos",
      "cervecería artesanal",
      "distribuidora bebidas",
      "coctelería bar",
      "sommelier asesoría",
      "degustación vinos",
      "importadora licores",
    ],
  },

  // 🛒 COMERCIO MINORISTA
  comercio: {
    keywords: [
      "tienda",
      "negocio",
      "local comercial",
      "almacen",
      "kiosco",
      "supermercado",
    ],
    synonyms: [
      "supermercado chino",
      "almacén de barrio",
      "dietética natural",
      "fiambrería carnicería",
      "verdulería frutería",
      "panadería confitería",
      "farmacia perfumería",
      "ferretería herramientas",
    ],
  },

  // 👗 MODA Y ROPA
  moda: {
    keywords: [
      "ropa",
      "moda",
      "indumentaria",
      "fashion",
      "vestidos",
      "zapatillas",
    ],
    synonyms: [
      "tienda de ropa",
      "boutique moda",
      "zapatería calzado",
      "lencería corsetería",
      "ropa deportiva",
      "moda hombre",
      "moda mujer",
      "accesorios bijouterie",
    ],
  },

  // 💍 JOYERÍA Y RELOJERÍA
  joyeria: {
    keywords: ["joyeria", "joyas", "relojeria", "oro", "plata", "anillos"],
    synonyms: [
      "joyería oro plata",
      "relojería reparación",
      "alianzas matrimonio",
      "bijouterie accesorios",
      "grabado personalizado",
      "compra oro usado",
      "perlas y piedras",
      "regalos joyería",
    ],
  },

  // 🏭 INDUSTRIA Y FABRICACIÓN
  industria: {
    keywords: [
      "fabrica",
      "industria",
      "manufactura",
      "produccion",
      "metalurgica",
    ],
    synonyms: [
      "fábrica manufactura",
      "metalúrgica herrería",
      "carpintería industrial",
      "plásticos inyección",
      "textil confección",
      "imprenta gráfica",
      "packaging envases",
      "maquinaria industrial",
    ],
  },

  // 🚚 TRANSPORTE
  transporte: {
    keywords: ["transporte", "remis", "taxi", "uber", "transfer", "combi"],
    synonyms: [
      "remis ejecutivo",
      "taxi radiollamada",
      "transfer aeropuerto",
      "combi escolar",
      "transporte de personal",
      "charter turismo",
      "ambulancia traslados",
      "grúa auxilio",
    ],
  },

  // ⚙️ SERVICIOS GENERALES
  servicios: {
    keywords: ["servicios", "reparacion", "arreglos", "mantenimiento general"],
    synonyms: [
      "service electrodomésticos",
      "reparación heladeras",
      "técnico lavarropas",
      "aire acondicionado",
      "service TV audio",
      "tapicería retapizado",
      "cristalería vidrios",
      "pinturería pintores",
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
