/**
 * 🧪 CRM Export Service Tests (Optimized)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { crmExportService } from "../services/crmExportService";

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn().mockResolvedValue({ data: { id: "page-123" } }),
      get: vi.fn().mockResolvedValue({ data: { results: [] } }),
    })),
    post: vi.fn().mockResolvedValue({ data: { records: [{ id: "rec123" }] } }),
  },
}));

describe("crmExportService", () => {
  const mockLead = {
    id: "lead-1",
    businessName: "Test Business",
    category: "Restaurant",
    address: "123 Test St",
    phoneRaw: "+1234567890",
    emails: ["test@test.com"],
    googleRating: 4.5,
    reviewCount: 100,
    hasWebsite: true,
    websiteUrl: "https://test.com",
    leadScore: 85,
    outreachStatus: "pending",
    googleMapsUrl: "https://maps.google.com/...",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportToNotion", () => {
    test("returns error when config is incomplete", async () => {
      const result = await crmExportService.exportToNotion([mockLead], {
        apiKey: "",
        databaseId: "",
      });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("returns proper ExportResult structure", async () => {
      const result = await crmExportService.exportToNotion([mockLead], {
        apiKey: "key",
        databaseId: "db-123",
      });
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("exported");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("errors");
    });

    test("handles empty leads array", async () => {
      const result = await crmExportService.exportToNotion([], {
        apiKey: "key",
        databaseId: "db",
      });
      expect(result.exported).toBe(0);
    });
  });

  describe("exportToAirtable", () => {
    test("returns error when config is incomplete", async () => {
      const result = await crmExportService.exportToAirtable([mockLead], {
        apiKey: "",
        baseId: "",
        tableName: "",
      });
      expect(result.success).toBe(false);
    });

    test("returns proper ExportResult structure", async () => {
      const result = await crmExportService.exportToAirtable([mockLead], {
        apiKey: "key",
        baseId: "app123",
        tableName: "Leads",
      });
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("exported");
    });
  });

  describe("setup instructions", () => {
    test("getNotionSetupInstructions returns valid instructions", () => {
      const instructions = crmExportService.getNotionSetupInstructions();
      expect(instructions.length).toBeGreaterThan(100);
      expect(instructions).toContain("Notion");
    });

    test("getAirtableSetupInstructions returns valid instructions", () => {
      const instructions = crmExportService.getAirtableSetupInstructions();
      expect(instructions.length).toBeGreaterThan(100);
      expect(instructions).toContain("Airtable");
    });
  });

  describe("testNotionConnection", () => {
    test("returns connection status", async () => {
      const result = await crmExportService.testNotionConnection({
        apiKey: "key",
        databaseId: "db",
      });
      expect(result).toHaveProperty("ok");
    });
  });
});
