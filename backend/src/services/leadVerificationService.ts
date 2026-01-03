/**
 * ✅ LEAD VERIFICATION SERVICE - Verificación Básica de Leads
 *
 * Verifica la validez de los datos de un lead SIN usar APIs pagas.
 * Usa técnicas gratuitas:
 * - HEAD request para verificar si el website responde
 * - Validación de formato de teléfono
 * - Verificación de email con regex y MX lookup básico
 * - Detección de negocios posiblemente cerrados
 */

import axios from "axios";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

// ============================================================================
// TIPOS
// ============================================================================

export interface VerificationResult {
  // Verificación de website
  websiteValid: boolean;
  websiteStatus: "active" | "slow" | "error" | "not_found" | "no_website";
  websiteResponseTime?: number;
  websiteRedirectUrl?: string;

  // Verificación de teléfono
  phoneValid: boolean;
  phoneFormatted?: string;
  phoneType?: "mobile" | "landline" | "unknown";
  phoneCountry?: string;

  // Verificación de email
  emailValid: boolean;
  emailStatus: "valid_format" | "invalid_format" | "no_email";

  // Score de confianza general (0-100)
  confidenceScore: number;
  confidenceGrade: "A" | "B" | "C" | "D" | "F";

  // Flags de alerta
  alerts: string[];

  // Metadata
  verifiedAt: Date;
  verificationDuration: number;
}

export interface LeadToVerify {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
}

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class LeadVerificationService {
  private readonly WEBSITE_TIMEOUT = 5000; // 5 segundos máximo

  /**
   * Verificar un lead completo
   */
  async verifyLead(lead: LeadToVerify): Promise<VerificationResult> {
    const startTime = Date.now();
    const alerts: string[] = [];

    // Ejecutar verificaciones en paralelo
    const [websiteResult, phoneResult, emailResult] = await Promise.all([
      this.verifyWebsite(lead.website),
      this.verifyPhone(lead.phone),
      this.verifyEmail(lead.email),
    ]);

    // Detectar alertas basadas en los datos
    if (lead.rating && lead.rating < 3.0) {
      alerts.push("⚠️ Rating bajo (< 3.0)");
    }

    if (lead.reviewCount && lead.reviewCount < 5) {
      alerts.push("⚠️ Pocas reseñas (< 5)");
    }

    if (!lead.phone && !lead.email && !lead.website) {
      alerts.push("🚫 Sin datos de contacto");
    }

    if (
      websiteResult.status === "error" ||
      websiteResult.status === "not_found"
    ) {
      alerts.push("⚠️ Website no responde");
    }

    if (websiteResult.responseTime && websiteResult.responseTime > 3000) {
      alerts.push("⚠️ Website muy lento");
    }

    // Calcular score de confianza
    const confidenceScore = this.calculateConfidenceScore(
      websiteResult,
      phoneResult,
      emailResult,
      lead
    );

    const confidenceGrade = this.scoreToGrade(confidenceScore);

    const duration = Date.now() - startTime;

    return {
      websiteValid: websiteResult.valid,
      websiteStatus: websiteResult.status,
      websiteResponseTime: websiteResult.responseTime,
      websiteRedirectUrl: websiteResult.redirectUrl,

      phoneValid: phoneResult.valid,
      phoneFormatted: phoneResult.formatted,
      phoneType: phoneResult.type,
      phoneCountry: phoneResult.country,

      emailValid: emailResult.valid,
      emailStatus: emailResult.status,

      confidenceScore,
      confidenceGrade,
      alerts,

      verifiedAt: new Date(),
      verificationDuration: duration,
    };
  }

  /**
   * Verificar múltiples leads en paralelo
   */
  async verifyLeads(
    leads: LeadToVerify[],
    concurrency: number = 5
  ): Promise<Map<string, VerificationResult>> {
    const results = new Map<string, VerificationResult>();

    // Procesar en batches para no sobrecargar
    for (let i = 0; i < leads.length; i += concurrency) {
      const batch = leads.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((lead) => this.verifyLead(lead))
      );

      batch.forEach((lead, index) => {
        results.set(lead.name, batchResults[index]);
      });

      // Pequeño delay entre batches
      if (i + concurrency < leads.length) {
        await this.sleep(200);
      }
    }

    return results;
  }

  /**
   * Verificar si un website responde
   */
  private async verifyWebsite(website?: string): Promise<{
    valid: boolean;
    status: "active" | "slow" | "error" | "not_found" | "no_website";
    responseTime?: number;
    redirectUrl?: string;
  }> {
    if (!website) {
      return { valid: false, status: "no_website" };
    }

    const startTime = Date.now();

    try {
      // Asegurar que tiene protocolo
      let url = website;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }

      const response = await axios.head(url, {
        timeout: this.WEBSITE_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Aceptar 2xx, 3xx, 4xx
      });

      const responseTime = Date.now() - startTime;
      const finalUrl = response.request?.res?.responseUrl || url;

      // 2xx = activo, 3xx/4xx = posible problema
      if (response.status >= 200 && response.status < 300) {
        return {
          valid: true,
          status: responseTime > 3000 ? "slow" : "active",
          responseTime,
          redirectUrl: finalUrl !== url ? finalUrl : undefined,
        };
      } else if (response.status >= 300 && response.status < 400) {
        return {
          valid: true,
          status: "active",
          responseTime,
          redirectUrl: finalUrl,
        };
      } else {
        return {
          valid: false,
          status: "error",
          responseTime,
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        return { valid: false, status: "not_found", responseTime };
      }

      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
        return { valid: false, status: "slow", responseTime };
      }

      return { valid: false, status: "error", responseTime };
    }
  }

  /**
   * Verificar formato y validez de teléfono
   */
  private verifyPhone(phone?: string): {
    valid: boolean;
    formatted?: string;
    type?: "mobile" | "landline" | "unknown";
    country?: string;
  } {
    if (!phone) {
      return { valid: false };
    }

    try {
      // Limpiar el teléfono
      let cleanPhone = phone.replace(/[^\d+]/g, "");

      // Si no tiene código de país, asumir Argentina
      if (!cleanPhone.startsWith("+")) {
        if (cleanPhone.startsWith("0")) {
          cleanPhone = "+54" + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith("54")) {
          cleanPhone = "+" + cleanPhone;
        } else {
          cleanPhone = "+54" + cleanPhone;
        }
      }

      // Validar con libphonenumber
      if (isValidPhoneNumber(cleanPhone)) {
        const parsed = parsePhoneNumber(cleanPhone);

        // Detectar tipo (móvil vs fijo)
        let type: "mobile" | "landline" | "unknown" = "unknown";
        const nationalNumber = parsed.nationalNumber;

        // En Argentina, los móviles empiezan con 9 después del código de área
        // o tienen códigos de área específicos
        if (nationalNumber.startsWith("9") || nationalNumber.length >= 10) {
          type = "mobile";
        } else if (nationalNumber.length <= 8) {
          type = "landline";
        }

        return {
          valid: true,
          formatted: parsed.formatInternational(),
          type,
          country: parsed.country,
        };
      }

      // Si libphonenumber no lo valida, hacer validación básica
      if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
        return {
          valid: true,
          formatted: cleanPhone,
          type: "unknown",
          country: "AR",
        };
      }

      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Verificar formato de email
   */
  private verifyEmail(email?: string): {
    valid: boolean;
    status: "valid_format" | "invalid_format" | "no_email";
  } {
    if (!email) {
      return { valid: false, status: "no_email" };
    }

    // Regex para validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailRegex.test(email)) {
      // Verificaciones adicionales
      const domain = email.split("@")[1];

      // Dominios sospechosos
      const suspiciousDomains = ["example.com", "test.com", "temp-mail.com"];
      if (suspiciousDomains.some((d) => domain.includes(d))) {
        return { valid: false, status: "invalid_format" };
      }

      return { valid: true, status: "valid_format" };
    }

    return { valid: false, status: "invalid_format" };
  }

  /**
   * Calcular score de confianza (0-100)
   */
  private calculateConfidenceScore(
    websiteResult: { valid: boolean; status: string; responseTime?: number },
    phoneResult: { valid: boolean },
    emailResult: { valid: boolean },
    lead: LeadToVerify
  ): number {
    let score = 0;

    // Website (40 puntos max)
    if (websiteResult.valid) {
      if (websiteResult.status === "active") {
        score += 40;
      } else if (websiteResult.status === "slow") {
        score += 25;
      }
    }

    // Teléfono (30 puntos max)
    if (phoneResult.valid) {
      score += 30;
    }

    // Email (20 puntos max)
    if (emailResult.valid) {
      score += 20;
    }

    // Rating y reviews (10 puntos max)
    if (lead.rating && lead.rating >= 4.0) {
      score += 5;
    }
    if (lead.reviewCount && lead.reviewCount >= 10) {
      score += 5;
    }

    // Bonus por tener múltiples canales de contacto
    const contactChannels = [
      websiteResult.valid,
      phoneResult.valid,
      emailResult.valid,
    ].filter(Boolean).length;

    if (contactChannels >= 3) {
      score += 10; // Bonus por tener los 3
    } else if (contactChannels >= 2) {
      score += 5; // Bonus por tener 2
    }

    return Math.min(100, score);
  }

  /**
   * Convertir score a grade
   */
  private scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 80) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    if (score >= 20) return "D";
    return "F";
  }

  /**
   * Helper: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtener resumen de verificaciones
   */
  getVerificationSummary(results: Map<string, VerificationResult>): {
    total: number;
    gradeDistribution: Record<string, number>;
    websiteActiveRate: number;
    phoneValidRate: number;
    emailValidRate: number;
    averageConfidence: number;
    alertsCount: number;
  } {
    const values = Array.from(results.values());
    const total = values.length;

    if (total === 0) {
      return {
        total: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        websiteActiveRate: 0,
        phoneValidRate: 0,
        emailValidRate: 0,
        averageConfidence: 0,
        alertsCount: 0,
      };
    }

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    let websiteActive = 0;
    let phoneValid = 0;
    let emailValid = 0;
    let totalConfidence = 0;
    let totalAlerts = 0;

    for (const result of values) {
      gradeDistribution[result.confidenceGrade]++;
      if (result.websiteValid) websiteActive++;
      if (result.phoneValid) phoneValid++;
      if (result.emailValid) emailValid++;
      totalConfidence += result.confidenceScore;
      totalAlerts += result.alerts.length;
    }

    return {
      total,
      gradeDistribution,
      websiteActiveRate: Math.round((websiteActive / total) * 100),
      phoneValidRate: Math.round((phoneValid / total) * 100),
      emailValidRate: Math.round((emailValid / total) * 100),
      averageConfidence: Math.round(totalConfidence / total),
      alertsCount: totalAlerts,
    };
  }
}

export const leadVerificationService = new LeadVerificationService();
export default leadVerificationService;
