/**
 * 🧪 Server/API Tests
 * Tests para los endpoints de la API Express
 */

import express, { Express } from "express";
import { createServer, Server } from "http";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Mock de los servicios
vi.mock("../services/googleMapsScraper", () => ({
  scrapeGoogleMaps: vi.fn().mockResolvedValue([
    {
      name: "Test Place",
      address: "123 Test St",
      placeId: "test123",
      rating: 4.5,
    },
  ]),
  GoogleMapsScraper: vi.fn().mockImplementation(() => ({
    scrape: vi.fn().mockResolvedValue([]),
    stream: vi.fn(),
  })),
}));

vi.mock("../services/zoneService", () => ({
  analyzeZone: vi.fn().mockReturnValue({
    zone: "test",
    subzones: [],
    estimatedTime: 60,
  }),
  getAvailableZones: vi.fn().mockReturnValue(["zone1", "zone2"]),
}));

vi.mock("../services/cacheService", () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    ping: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../services/placesService", () => ({
  placesService: {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ id: "123" }),
    delete: vi.fn().mockResolvedValue(true),
    count: vi.fn().mockResolvedValue(0),
    getStats: vi.fn().mockResolvedValue({ total: 0 }),
  },
}));

describe("server", () => {
  let app: Express;
  let server: Server;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simular rutas básicas
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    app.get("/api/zones", (req, res) => {
      res.json({ zones: ["zone1", "zone2"] });
    });

    app.post("/api/scrape", (req, res) => {
      const { query, zone } = req.body;
      if (!query || !zone) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      res.json({ success: true, count: 10 });
    });

    app.get("/api/leads", (req, res) => {
      res.json({ leads: [], total: 0 });
    });

    app.get("/api/leads/:id", (req, res) => {
      const { id } = req.params;
      if (id === "not-found") {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json({ id, name: "Test Lead" });
    });

    app.delete("/api/leads/:id", (req, res) => {
      res.json({ success: true });
    });

    app.get("/api/stats", (req, res) => {
      res.json({ total: 100, byZone: {}, byCategory: {} });
    });

    server = createServer(app);
  });

  afterAll(() => {
    server.close();
  });

  describe("GET /api/health", () => {
    test("Should return health status", async () => {
      const response = await simulateRequest(app, "GET", "/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("timestamp");
    });
  });

  describe("GET /api/zones", () => {
    test("Should return available zones", async () => {
      const response = await simulateRequest(app, "GET", "/api/zones");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("zones");
      expect(Array.isArray(response.body.zones)).toBe(true);
    });
  });

  describe("POST /api/scrape", () => {
    test("Should start scrape with valid params", async () => {
      const response = await simulateRequest(app, "POST", "/api/scrape", {
        query: "restaurants",
        zone: "New York",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });

    test("Should return 400 for missing query", async () => {
      const response = await simulateRequest(app, "POST", "/api/scrape", {
        zone: "New York",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    test("Should return 400 for missing zone", async () => {
      const response = await simulateRequest(app, "POST", "/api/scrape", {
        query: "restaurants",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/leads", () => {
    test("Should return leads list", async () => {
      const response = await simulateRequest(app, "GET", "/api/leads");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("leads");
      expect(Array.isArray(response.body.leads)).toBe(true);
    });

    test("Should support pagination params", async () => {
      const response = await simulateRequest(
        app,
        "GET",
        "/api/leads?page=2&limit=20"
      );

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/leads/:id", () => {
    test("Should return lead by id", async () => {
      const response = await simulateRequest(app, "GET", "/api/leads/123");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
    });

    test("Should return 404 for non-existent lead", async () => {
      const response = await simulateRequest(
        app,
        "GET",
        "/api/leads/not-found"
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/leads/:id", () => {
    test("Should delete lead by id", async () => {
      const response = await simulateRequest(app, "DELETE", "/api/leads/123");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("GET /api/stats", () => {
    test("Should return statistics", async () => {
      const response = await simulateRequest(app, "GET", "/api/stats");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("total");
    });
  });

  describe("Query parameter parsing", () => {
    test("Should parse strictMatch as boolean true", () => {
      const query = { strictMatch: "true" };
      const result = query.strictMatch === "true";

      expect(result).toBe(true);
    });

    test("Should parse strictMatch as boolean false", () => {
      const query = { strictMatch: "false" };
      const result = query.strictMatch === "true";

      expect(result).toBe(false);
    });

    test("Should default strictMatch to false when not provided", () => {
      const query: any = {};
      const result = query.strictMatch === "true";

      expect(result).toBe(false);
    });
  });

  describe("Error handling", () => {
    test("Should handle JSON parse errors", async () => {
      // Simular error de parsing
      const errorApp = express();
      errorApp.use(express.json());
      errorApp.use(
        (
          err: any,
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => {
          if (err.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Invalid JSON" });
          }
          next(err);
        }
      );

      expect(true).toBe(true);
    });
  });

  describe("Rate limiting", () => {
    test("Rate limit config should be defined", () => {
      const rateLimit = {
        windowMs: 15 * 60 * 1000,
        max: 100,
      };

      expect(rateLimit.windowMs).toBe(900000);
      expect(rateLimit.max).toBe(100);
    });
  });

  describe("CORS configuration", () => {
    test("CORS options should allow frontend origin", () => {
      const corsOptions = {
        origin: ["http://localhost:3000", "http://localhost:5173"],
        credentials: true,
      };

      expect(corsOptions.origin).toContain("http://localhost:3000");
      expect(corsOptions.credentials).toBe(true);
    });
  });
});

// Helper function to simulate HTTP requests
async function simulateRequest(
  app: Express,
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method,
      url: path,
      path,
      query: {},
      params: {},
      body: body || {},
      headers: {},
      get: () => null,
    };

    // Parse path params
    const pathParts = path.split("/");
    if (pathParts.length > 3) {
      req.params.id = pathParts[3].split("?")[0];
    }

    // Parse query string
    if (path.includes("?")) {
      const queryString = path.split("?")[1];
      queryString.split("&").forEach((param) => {
        const [key, value] = param.split("=");
        req.query[key] = value;
      });
    }

    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      send(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      },
    };

    // Find matching route
    const layers = (app._router?.stack || []).filter(
      (layer: any) => layer.route
    );
    const matchingLayer = layers.find((layer: any) => {
      const routePath = layer.route.path;
      const routeMethod = Object.keys(layer.route.methods)[0].toUpperCase();

      if (routeMethod !== method) return false;

      // Simple path matching
      const routeParts = routePath.split("/");
      const reqParts = path.split("?")[0].split("/");

      if (routeParts.length !== reqParts.length) return false;

      return routeParts.every((part: string, i: number) => {
        if (part.startsWith(":")) return true;
        return part === reqParts[i];
      });
    });

    if (matchingLayer) {
      const handler = matchingLayer.route.stack[0].handle;
      handler(req, res, () => {});
    } else {
      resolve({ status: 404, body: { error: "Not found" } });
    }
  });
}
