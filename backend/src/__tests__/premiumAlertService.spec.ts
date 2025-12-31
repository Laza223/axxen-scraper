/**
 * 🧪 Premium Alert Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import premiumAlertService from "../services/premiumAlertService";

describe("premiumAlertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateLead - Premium leads (score >= 70)", () => {
    test("lead sin web + popular + zona premium returns alert", () => {
      const lead = {
        id: "lead-1",
        businessName: "Restaurante Premium",
        category: "Restaurante",
        address: "Av. Libertador 1234, Palermo, Buenos Aires",
        googleRating: 4.7,
        reviewCount: 150,
        hasWebsite: false,
        websiteUrl: null,
        leadScore: 85,
        phoneRaw: "+5411123456",
        instagramUrl: "https://instagram.com/resto",
        facebookUrl: null,
      };

      const alert = premiumAlertService.evaluateLead(lead);
      expect(alert).not.toBeNull();
      expect(alert!.score).toBeGreaterThanOrEqual(70);
      expect(alert!.reasons.length).toBeGreaterThan(0);
      expect(alert!.suggestedAction).toBeDefined();
      expect(alert!.estimatedValue).toBeDefined();
    });

    test("lead sin web + muchas reviews es premium", () => {
      const lead = {
        id: "lead-2",
        businessName: "Clínica Dental",
        category: "Clínica Dental",
        address: "Recoleta, Buenos Aires",
        googleRating: 4.8,
        reviewCount: 200,
        hasWebsite: false,
        leadScore: 90,
      };

      const alert = premiumAlertService.evaluateLead(lead);
      expect(alert).not.toBeNull();
      expect(alert!.reasons).toContainEqual(expect.stringContaining("reseñas"));
    });

    test("lead con categoría alto valor es premium", () => {
      const lead = {
        id: "lead-3",
        businessName: "Estudio Jurídico",
        category: "Abogados",
        address: "Recoleta, Buenos Aires",
        googleRating: 4.5,
        reviewCount: 80,
        hasWebsite: false,
        leadScore: 75,
      };

      const alert = premiumAlertService.evaluateLead(lead);
      expect(alert).not.toBeNull();
      expect(alert!.reasons).toContainEqual(
        expect.stringContaining("alto ticket")
      );
    });

    test("lead con redes sociales obtiene bonus", () => {
      const lead = {
        id: "lead-4",
        businessName: "Café Hipster",
        category: "Cafetería",
        address: "Palermo, Buenos Aires",
        googleRating: 4.6,
        reviewCount: 60,
        hasWebsite: false,
        leadScore: 70,
        instagramUrl: "https://instagram.com/cafe",
        facebookUrl: "https://facebook.com/cafe",
      };

      const alert = premiumAlertService.evaluateLead(lead);
      expect(alert).not.toBeNull();
      expect(alert!.reasons).toContainEqual(
        expect.stringContaining("redes sociales")
      );
    });
  });

  describe("evaluateLead - Non-premium leads (score < 70)", () => {
    test("lead con web + pocos reviews NO es premium", () => {
      const alert = premiumAlertService.evaluateLead({
        id: "lead-5",
        businessName: "Kiosko",
        category: "Kiosco",
        address: "Calle X",
        googleRating: 3.5,
        reviewCount: 5,
        hasWebsite: true,
        websiteUrl: "https://kiosko.com",
        leadScore: 20,
      });
      expect(alert).toBeNull();
    });

    test("lead con baja reputación NO es premium", () => {
      const alert = premiumAlertService.evaluateLead({
        id: "lead-6",
        businessName: "Negocio",
        category: "Tienda",
        address: "Calle X",
        googleRating: 2.5,
        reviewCount: 10,
        hasWebsite: false,
        leadScore: 30,
      });
      expect(alert).toBeNull();
    });
  });

  describe("priority levels", () => {
    test("score >= 85 es HIGH priority", () => {
      const alert = premiumAlertService.evaluateLead({
        id: "high-1",
        businessName: "Super Premium",
        category: "Clínica Estética",
        address: "Puerto Madero, Buenos Aires",
        googleRating: 4.9,
        reviewCount: 300,
        hasWebsite: false,
        leadScore: 95,
      });
      expect(alert?.priority).toBe("high");
    });
  });

  describe("onAlert", () => {
    test("registers callback and returns unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = premiumAlertService.onAlert(callback);
      expect(typeof unsubscribe).toBe("function");
    });
  });
});
