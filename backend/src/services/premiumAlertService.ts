import logger from "./logger";

/**
 * 🔔 Premium Lead Alert Service
 *
 * Detecta leads de alto valor y genera alertas en tiempo real.
 * Un lead premium es aquel que combina:
 * - Alta demanda (muchas reviews)
 * - Buena reputación (rating alto)
 * - Oportunidad clara (sin web o web mala)
 * - Zona premium
 */

export interface PremiumAlert {
  leadId: string;
  businessName: string;
  score: number;
  reasons: string[];
  priority: "high" | "medium" | "low";
  suggestedAction: string;
  estimatedValue: string;
  createdAt: Date;
}

interface LeadData {
  id: string;
  businessName: string;
  category: string;
  address: string;
  googleRating?: number | null;
  reviewCount: number;
  hasWebsite: boolean;
  websiteUrl?: string | null;
  leadScore: number;
  phoneRaw?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
}

// Zonas premium de Argentina
const PREMIUM_ZONES = [
  "nordelta",
  "puerto madero",
  "recoleta",
  "palermo",
  "san isidro",
  "vicente lopez",
  "vicente lópez",
  "martinez",
  "martínez",
  "olivos",
  "belgrano",
  "núñez",
  "nunez",
  "las cañitas",
  "colegiales",
  "villa crespo",
  "caballito",
  "devoto",
  "villa urquiza",
  "saavedra",
  "cañitas",
  // México
  "polanco",
  "santa fe",
  "condesa",
  "roma norte",
  "lomas de chapultepec",
  "interlomas",
  // España
  "salamanca",
  "chamberí",
  "retiro",
  "chamartín",
  // Colombia
  "chapinero",
  "usaquén",
  "chicó",
];

// Categorías de alto valor
const HIGH_VALUE_CATEGORIES = [
  "clínica",
  "clinica",
  "estética",
  "estetica",
  "cirugía",
  "cirugia",
  "odontología",
  "odontologia",
  "dentista",
  "dental",
  "abogado",
  "abogados",
  "inmobiliaria",
  "real estate",
  "arquitecto",
  "arquitectura",
  "contador",
  "contadora",
  "consultoría",
  "consultoria",
  "clínica veterinaria",
  "spa",
  "medicina estética",
  "psicólogo",
  "psicologo",
  "nutricionista",
  "fisioterapia",
  "kinesiología",
];

class PremiumAlertService {
  private alertHistory: PremiumAlert[] = [];
  private listeners: ((alert: PremiumAlert) => void)[] = [];

  /**
   * Evaluar si un lead es premium y generar alerta
   */
  evaluateLead(lead: LeadData): PremiumAlert | null {
    const evaluation = this.calculatePremiumScore(lead);

    if (evaluation.score < 70) {
      return null; // No es premium
    }

    const priority = this.determinePriority(evaluation.score);
    const suggestedAction = this.getSuggestedAction(lead, evaluation);
    const estimatedValue = this.estimateValue(lead, evaluation);

    const alert: PremiumAlert = {
      leadId: lead.id,
      businessName: lead.businessName,
      score: evaluation.score,
      reasons: evaluation.reasons,
      priority,
      suggestedAction,
      estimatedValue,
      createdAt: new Date(),
    };

    // Guardar en historial
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.pop();
    }

    // Notificar a listeners
    this.notifyListeners(alert);

    logger.info(
      `🔔 ALERTA PREMIUM: ${lead.businessName} | Score: ${
        evaluation.score
      } | ${priority.toUpperCase()}`
    );

    return alert;
  }

  /**
   * Calcular score premium de un lead
   */
  private calculatePremiumScore(lead: LeadData): {
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Sin website = OPORTUNIDAD (+30)
    if (!lead.hasWebsite) {
      score += 30;
      reasons.push("🎯 Sin presencia web - oportunidad de venta directa");
    }

    // 2. Solo redes sociales (+15)
    if (!lead.hasWebsite && (lead.instagramUrl || lead.facebookUrl)) {
      score += 15;
      reasons.push("📱 Solo usa redes sociales - necesita web profesional");
    }

    // 3. Alta demanda: muchas reviews (+25 max)
    if (lead.reviewCount >= 200) {
      score += 25;
      reasons.push(`🔥 Muy popular: ${lead.reviewCount} reseñas`);
    } else if (lead.reviewCount >= 100) {
      score += 20;
      reasons.push(`⭐ Popular: ${lead.reviewCount} reseñas`);
    } else if (lead.reviewCount >= 50) {
      score += 15;
      reasons.push(`📈 Buena demanda: ${lead.reviewCount} reseñas`);
    } else if (lead.reviewCount >= 25) {
      score += 10;
      reasons.push(`✓ Demanda moderada: ${lead.reviewCount} reseñas`);
    }

    // 4. Excelente reputación (+15)
    if (lead.googleRating && lead.googleRating >= 4.5) {
      score += 15;
      reasons.push(`⭐ Excelente reputación: ${lead.googleRating}/5`);
    } else if (lead.googleRating && lead.googleRating >= 4.0) {
      score += 10;
      reasons.push(`⭐ Buena reputación: ${lead.googleRating}/5`);
    }

    // 5. Zona premium (+15)
    const isPremiumZone = this.isInPremiumZone(lead.address);
    if (isPremiumZone) {
      score += 15;
      reasons.push("📍 Ubicado en zona premium");
    }

    // 6. Categoría de alto valor (+10)
    const isHighValue = this.isHighValueCategory(lead.category);
    if (isHighValue) {
      score += 10;
      reasons.push(`💎 Categoría de alto ticket: ${lead.category}`);
    }

    // 7. Tiene teléfono = contactable (+5)
    if (lead.phoneRaw) {
      score += 5;
      reasons.push("📞 Teléfono disponible - fácil de contactar");
    }

    // 8. Combinación letal: sin web + popular + zona premium (+10 bonus)
    if (!lead.hasWebsite && lead.reviewCount >= 50 && isPremiumZone) {
      score += 10;
      reasons.push("🚀 COMBO: Sin web + Popular + Zona premium = URGENTE");
    }

    return { score: Math.min(100, score), reasons };
  }

  /**
   * Verificar si está en zona premium
   */
  private isInPremiumZone(address: string): boolean {
    if (!address) return false;
    const normalized = address.toLowerCase();
    return PREMIUM_ZONES.some((zone) => normalized.includes(zone));
  }

  /**
   * Verificar si es categoría de alto valor
   */
  private isHighValueCategory(category: string): boolean {
    if (!category) return false;
    const normalized = category.toLowerCase();
    return HIGH_VALUE_CATEGORIES.some((cat) => normalized.includes(cat));
  }

  /**
   * Determinar prioridad
   */
  private determinePriority(score: number): "high" | "medium" | "low" {
    if (score >= 85) return "high";
    if (score >= 75) return "medium";
    return "low";
  }

  /**
   * Sugerir acción según el perfil del lead
   */
  private getSuggestedAction(
    lead: LeadData,
    evaluation: { score: number; reasons: string[] }
  ): string {
    if (!lead.hasWebsite && lead.reviewCount >= 50) {
      return "🔥 CONTACTAR HOY - Negocio establecido sin web, alta probabilidad de cierre";
    }

    if (!lead.hasWebsite && this.isInPremiumZone(lead.address)) {
      return "📞 Llamar esta semana - Cliente premium sin presencia digital";
    }

    if (lead.reviewCount >= 100) {
      return "💼 Preparar propuesta completa - Cliente de alto volumen";
    }

    if (this.isHighValueCategory(lead.category)) {
      return "📧 Enviar caso de éxito del rubro - Cliente de alto ticket";
    }

    return "📋 Agregar a secuencia de outreach - Lead calificado";
  }

  /**
   * Estimar valor potencial
   */
  private estimateValue(lead: LeadData, evaluation: { score: number }): string {
    const isPremiumZone = this.isInPremiumZone(lead.address);
    const isHighValue = this.isHighValueCategory(lead.category);

    if ((isPremiumZone || isHighValue) && lead.reviewCount >= 50) {
      return "💰💰💰 Alto ($2,000 - $5,000+)";
    }

    if (isPremiumZone || isHighValue || lead.reviewCount >= 30) {
      return "💰💰 Medio ($800 - $2,000)";
    }

    return "💰 Estándar ($300 - $800)";
  }

  /**
   * Registrar listener para alertas en tiempo real
   */
  onAlert(callback: (alert: PremiumAlert) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notificar a todos los listeners
   */
  private notifyListeners(alert: PremiumAlert): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        logger.warn("Error notificando listener de alertas");
      }
    }
  }

  /**
   * Obtener alertas recientes
   */
  getRecentAlerts(limit = 20): PremiumAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Obtener estadísticas de alertas
   */
  getAlertStats(): {
    total: number;
    high: number;
    medium: number;
    low: number;
    avgScore: number;
  } {
    const high = this.alertHistory.filter((a) => a.priority === "high").length;
    const medium = this.alertHistory.filter(
      (a) => a.priority === "medium"
    ).length;
    const low = this.alertHistory.filter((a) => a.priority === "low").length;
    const avgScore =
      this.alertHistory.length > 0
        ? Math.round(
            this.alertHistory.reduce((sum, a) => sum + a.score, 0) /
              this.alertHistory.length
          )
        : 0;

    return {
      total: this.alertHistory.length,
      high,
      medium,
      low,
      avgScore,
    };
  }

  /**
   * Formatear alerta para mostrar
   */
  formatAlert(alert: PremiumAlert): string {
    const priorityEmoji = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    };

    return `
${priorityEmoji[alert.priority]} **${alert.businessName}** (Score: ${
      alert.score
    }/100)
${alert.reasons.map((r) => `  • ${r}`).join("\n")}

📌 ${alert.suggestedAction}
${alert.estimatedValue}
    `.trim();
  }
}

export const premiumAlertService = new PremiumAlertService();
export default premiumAlertService;
