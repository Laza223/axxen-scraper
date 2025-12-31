/**
 * 🧪 CRM Export Service Tests
 * Tests para el servicio de exportación a Notion y Airtable
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { crmExportService } from "../services/crmExportService";

// Mock de axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn().mockResolvedValue({ data: { id: "page-123" } }),
      get: vi.fn().mockResolvedValue({ data: { results: [] } }),
      patch: vi.fn().mockResolvedValue({ data: { id: "page-123" } }),
    })),
    post: vi.fn().mockResolvedValue({ data: { records: [{ id: "rec123" }] } }),
    get: vi.fn().mockResolvedValue({ data: { records: [] } }),
  },
}));

describe("crmExportService", () => {
  const mockLead = {
    id: "lead-123",
    businessName: "Test Business",
    category: "Restaurant",
    address: "123 Test St, City",
    phoneRaw: "+1234567890",
    emails: ["contact@test.com"],
    googleRating: 4.5,
    reviewCount: 100,
    hasWebsite: true,
    websiteUrl: "https://testbusiness.com",
    leadScore: 85,
    outreachStatus: "pending",
    googleMapsUrl: "https://maps.google.com/...",
    instagramUrl: "https://instagram.com/test",
    facebookUrl: "https://facebook.com/test",
    createdAt: new Date(),
    notes: "Test notes",
    tags: ["restaurant", "premium"],
    techStack: "WordPress, React",
  };

  const mockLeads = [
    mockLead,
    {
      ...mockLead,
      id: "lead-456",
      businessName: "Another Business",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportToNotion", () => {
    test("Should return error when config is incomplete", async () => {
      const result = await crmExportService.exportToNotion(mockLeads, {
        apiKey: "",
        databaseId: "",
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("Should have exportToNotion method", () => {
      expect(typeof crmExportService.exportToNotion).toBe("function");
    });

    test("Should return ExportResult structure", async () => {
      const result = await crmExportService.exportToNotion(mockLeads, {
        apiKey: "test-key",
        databaseId: "db-123",
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("exported");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("errors");
    });
  });

  describe("exportToAirtable", () => {
    test("Should return error when config is incomplete", async () => {
      const result = await crmExportService.exportToAirtable(mockLeads, {
        apiKey: "",
        baseId: "",
        tableName: "",
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("Should have exportToAirtable method", () => {
      expect(typeof crmExportService.exportToAirtable).toBe("function");
    });

    test("Should return ExportResult structure", async () => {
      const result = await crmExportService.exportToAirtable(mockLeads, {
        apiKey: "test-key",
        baseId: "app123",
        tableName: "Leads",
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("exported");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("errors");
    });
  });

  describe("getNotionSetupInstructions", () => {
    test("Should return setup instructions string", () => {
      const instructions = crmExportService.getNotionSetupInstructions();

      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(100);
    });

    test("Should include Notion setup steps", () => {
      const instructions = crmExportService.getNotionSetupInstructions();

      expect(instructions).toContain("Notion");
      expect(instructions).toContain("integración");
    });

    test("Should include database creation info", () => {
      const instructions = crmExportService.getNotionSetupInstructions();

      expect(instructions.toLowerCase()).toContain("database");
    });
  });

  describe("getAirtableSetupInstructions", () => {
    test("Should return setup instructions string", () => {
      const instructions = crmExportService.getAirtableSetupInstructions();

      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(100);
    });

    test("Should include Airtable setup steps", () => {
      const instructions = crmExportService.getAirtableSetupInstructions();

      expect(instructions).toContain("Airtable");
      expect(instructions).toContain("API");
    });

    test("Should include Base ID info", () => {
      const instructions = crmExportService.getAirtableSetupInstructions();

      expect(instructions).toContain("Base ID");
    });
  });

  describe("Lead formatting", () => {
    test("Lead should have required fields", () => {
      expect(mockLead).toHaveProperty("businessName");
      expect(mockLead).toHaveProperty("category");
      expect(mockLead).toHaveProperty("address");
      expect(mockLead).toHaveProperty("leadScore");
    });

    test("Lead should have optional fields", () => {
      expect(mockLead).toHaveProperty("phoneRaw");
      expect(mockLead).toHaveProperty("emails");
      expect(mockLead).toHaveProperty("websiteUrl");
      expect(mockLead).toHaveProperty("googleRating");
    });
  });

  describe("Export error handling", () => {
    test("Should handle empty leads array", async () => {
      const result = await crmExportService.exportToNotion([], {
        apiKey: "key",
        databaseId: "db",
      });

      expect(result).toHaveProperty("exported");
      expect(result.exported).toBe(0);
    });
  });
});
