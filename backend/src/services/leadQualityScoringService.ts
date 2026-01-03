/**
 * 🏆 LEAD QUALITY SCORING SERVICE
 *
 * Servicio genérico para calcular un score de calidad (0-100) para cualquier lead.
 * Basado en la completitud y calidad de los datos.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface ScoringConfig {
  // Pesos de cada factor (deben sumar 100)
  weights: {
    hasRealWebsite: number; // Website propio (no redes sociales)
    hasEmail: number; // Email de contacto
    hasPhone: number; // Teléfono
    hasAddress: number; // Dirección física
    hasGoodRating: number; // Rating 4+ estrellas
    hasSocialMedia: number; // Redes sociales activas
    hasReviews: number; // Cantidad de reseñas
    hasBusinessHours: number; // Horarios de atención
  };
  // Umbrales
  thresholds: {
    goodRating: number; // Mínimo para "buena" calificación
    minReviews: number; // Mínimo de reseñas para considerarlo establecido
    activeFollowers: number; // Mínimo de seguidores para considerar activo
  };
}

export interface LeadData {
  name: string;
  website?: string;
  hasRealWebsite?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  instagramFollowers?: number;
  instagramUrl?: string;
  facebookUrl?: string;
  businessHours?: string[];
  category?: string;
}

export interface ScoringResult {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F"; // Calificación letra
  breakdown: {
    factor: string;
    points: number;
    maxPoints: number;
    hasValue: boolean;
  }[];
  recommendations: string[]; // Qué falta para mejorar el score
  qualityLevel: "excellent" | "good" | "average" | "poor" | "very_poor";
}

// ============================================================================
// CONFIGURACIÓN DEFAULT
// ============================================================================

const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    hasRealWebsite: 25, // Website propio es muy valioso
    hasEmail: 30, // Email es el más importante para contacto
    hasPhone: 15, // Teléfono es útil
    hasAddress: 10, // Dirección física
    hasGoodRating: 8, // Buenas reseñas
    hasSocialMedia: 5, // Redes sociales
    hasReviews: 4, // Tiene reseñas
    hasBusinessHours: 3, // Tiene horarios
  },
  thresholds: {
    goodRating: 4.0, // 4 estrellas o más
    minReviews: 5, // Al menos 5 reseñas
    activeFollowers: 100, // Al menos 100 seguidores
  },
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class LeadQualityScoringService {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calcula el score de calidad de un lead
   */
  calculateScore(lead: LeadData): ScoringResult {
    const breakdown: ScoringResult["breakdown"] = [];
    let totalScore = 0;

    // 1. Website real
    const hasRealWeb = this.hasRealWebsite(lead);
    const websitePoints = hasRealWeb ? this.config.weights.hasRealWebsite : 0;
    breakdown.push({
      factor: "Website propio",
      points: websitePoints,
      maxPoints: this.config.weights.hasRealWebsite,
      hasValue: hasRealWeb,
    });
    totalScore += websitePoints;

    // 2. Email
    const hasEmail = !!lead.email && this.isValidEmail(lead.email);
    const emailPoints = hasEmail ? this.config.weights.hasEmail : 0;
    breakdown.push({
      factor: "Email de contacto",
      points: emailPoints,
      maxPoints: this.config.weights.hasEmail,
      hasValue: hasEmail,
    });
    totalScore += emailPoints;

    // 3. Teléfono
    const hasPhone = !!lead.phone && lead.phone.length >= 8;
    const phonePoints = hasPhone ? this.config.weights.hasPhone : 0;
    breakdown.push({
      factor: "Teléfono",
      points: phonePoints,
      maxPoints: this.config.weights.hasPhone,
      hasValue: hasPhone,
    });
    totalScore += phonePoints;

    // 4. Dirección
    const hasAddress = !!lead.address && lead.address.length > 10;
    const addressPoints = hasAddress ? this.config.weights.hasAddress : 0;
    breakdown.push({
      factor: "Dirección física",
      points: addressPoints,
      maxPoints: this.config.weights.hasAddress,
      hasValue: hasAddress,
    });
    totalScore += addressPoints;

    // 5. Rating bueno
    const hasGoodRating =
      (lead.rating ?? 0) >= this.config.thresholds.goodRating;
    const ratingPoints = hasGoodRating ? this.config.weights.hasGoodRating : 0;
    breakdown.push({
      factor: "Rating 4+ estrellas",
      points: ratingPoints,
      maxPoints: this.config.weights.hasGoodRating,
      hasValue: hasGoodRating,
    });
    totalScore += ratingPoints;

    // 6. Redes sociales
    const hasSocial =
      !!lead.instagramUrl ||
      !!lead.facebookUrl ||
      (lead.instagramFollowers ?? 0) >= this.config.thresholds.activeFollowers;
    const socialPoints = hasSocial ? this.config.weights.hasSocialMedia : 0;
    breakdown.push({
      factor: "Redes sociales activas",
      points: socialPoints,
      maxPoints: this.config.weights.hasSocialMedia,
      hasValue: hasSocial,
    });
    totalScore += socialPoints;

    // 7. Reseñas
    const hasReviews =
      (lead.reviewCount ?? 0) >= this.config.thresholds.minReviews;
    const reviewPoints = hasReviews ? this.config.weights.hasReviews : 0;
    breakdown.push({
      factor: "Tiene reseñas",
      points: reviewPoints,
      maxPoints: this.config.weights.hasReviews,
      hasValue: hasReviews,
    });
    totalScore += reviewPoints;

    // 8. Horarios
    const hasHours = !!lead.businessHours && lead.businessHours.length > 0;
    const hoursPoints = hasHours ? this.config.weights.hasBusinessHours : 0;
    breakdown.push({
      factor: "Horarios de atención",
      points: hoursPoints,
      maxPoints: this.config.weights.hasBusinessHours,
      hasValue: hasHours,
    });
    totalScore += hoursPoints;

    // Calcular grade y quality level
    const grade = this.scoreToGrade(totalScore);
    const qualityLevel = this.scoreToQualityLevel(totalScore);

    // Generar recomendaciones
    const recommendations = this.generateRecommendations(breakdown);

    return {
      score: totalScore,
      grade,
      breakdown,
      recommendations,
      qualityLevel,
    };
  }

  /**
   * Verifica si tiene un website real (no redes sociales ni directorios)
   */
  private hasRealWebsite(lead: LeadData): boolean {
    if (lead.hasRealWebsite !== undefined) {
      return lead.hasRealWebsite;
    }

    if (!lead.website) return false;

    const url = lead.website.toLowerCase();

    // Lista de dominios que NO cuentan como website real
    const notRealWebsites = [
      "instagram.com",
      "facebook.com",
      "twitter.com",
      "linkedin.com",
      "youtube.com",
      "tiktok.com",
      "wa.me",
      "whatsapp.com",
      "linktr.ee",
      "linktree.com",
      "argenprop.com",
      "zonaprop.com",
      "mercadolibre.com",
    ];

    return !notRealWebsites.some((domain) => url.includes(domain));
  }

  /**
   * Valida un email básicamente
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convierte score a letra
   */
  private scoreToGrade(score: number): ScoringResult["grade"] {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  /**
   * Convierte score a nivel de calidad
   */
  private scoreToQualityLevel(score: number): ScoringResult["qualityLevel"] {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 55) return "average";
    if (score >= 40) return "poor";
    return "very_poor";
  }

  /**
   * Genera recomendaciones basadas en lo que falta
   */
  private generateRecommendations(
    breakdown: ScoringResult["breakdown"]
  ): string[] {
    const recommendations: string[] = [];

    for (const item of breakdown) {
      if (!item.hasValue && item.maxPoints >= 10) {
        switch (item.factor) {
          case "Email de contacto":
            recommendations.push(
              "Buscar email en website o redes sociales del negocio"
            );
            break;
          case "Website propio":
            recommendations.push(
              "Verificar si tiene website propio buscando en Google"
            );
            break;
          case "Teléfono":
            recommendations.push("Buscar teléfono en la ficha de Google Maps");
            break;
          case "Dirección física":
            recommendations.push("Verificar dirección en Google Maps");
            break;
        }
      }
    }

    return recommendations;
  }

  /**
   * Calcula el score promedio de una lista de leads
   */
  calculateAverageScore(leads: LeadData[]): number {
    if (leads.length === 0) return 0;

    const totalScore = leads.reduce((sum, lead) => {
      return sum + this.calculateScore(lead).score;
    }, 0);

    return Math.round(totalScore / leads.length);
  }

  /**
   * Filtra leads por score mínimo
   */
  filterByMinScore(leads: LeadData[], minScore: number): LeadData[] {
    return leads.filter((lead) => {
      return this.calculateScore(lead).score >= minScore;
    });
  }

  /**
   * Ordena leads por score (mayor a menor)
   */
  sortByScore(leads: LeadData[]): LeadData[] {
    return [...leads].sort((a, b) => {
      return this.calculateScore(b).score - this.calculateScore(a).score;
    });
  }

  /**
   * Agrupa leads por nivel de calidad
   */
  groupByQuality(
    leads: LeadData[]
  ): Record<ScoringResult["qualityLevel"], LeadData[]> {
    const groups: Record<ScoringResult["qualityLevel"], LeadData[]> = {
      excellent: [],
      good: [],
      average: [],
      poor: [],
      very_poor: [],
    };

    for (const lead of leads) {
      const result = this.calculateScore(lead);
      groups[result.qualityLevel].push(lead);
    }

    return groups;
  }

  /**
   * Resumen estadístico de calidad de leads
   */
  getQualitySummary(leads: LeadData[]): {
    total: number;
    averageScore: number;
    gradeDistribution: Record<ScoringResult["grade"], number>;
    qualityDistribution: Record<ScoringResult["qualityLevel"], number>;
    topFactorsMissing: { factor: string; count: number }[];
  } {
    const gradeDistribution: Record<ScoringResult["grade"], number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };
    const qualityDistribution: Record<ScoringResult["qualityLevel"], number> = {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
      very_poor: 0,
    };
    const missingFactors: Record<string, number> = {};

    for (const lead of leads) {
      const result = this.calculateScore(lead);
      gradeDistribution[result.grade]++;
      qualityDistribution[result.qualityLevel]++;

      for (const item of result.breakdown) {
        if (!item.hasValue) {
          missingFactors[item.factor] = (missingFactors[item.factor] || 0) + 1;
        }
      }
    }

    // Top factores faltantes ordenados
    const topFactorsMissing = Object.entries(missingFactors)
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: leads.length,
      averageScore: this.calculateAverageScore(leads),
      gradeDistribution,
      qualityDistribution,
      topFactorsMissing,
    };
  }
}

export default new LeadQualityScoringService();
