import axios from "axios";
import logger from "./logger";

/**
 * 📤 CRM Export Service - Exportar leads a Notion y Airtable
 *
 * Permite sincronizar leads con CRMs populares para seguimiento.
 */

interface Lead {
  id: string;
  businessName: string;
  category: string;
  address: string;
  phoneRaw?: string | null;
  emails?: string[];
  googleRating?: number | null;
  reviewCount: number;
  hasWebsite: boolean;
  websiteUrl?: string | null;
  leadScore: number;
  outreachStatus: string;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  createdAt: Date;
  notes?: string | null;
  tags?: string[];
  techStack?: string | null;
}

interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

interface AirtableConfig {
  apiKey: string;
  baseId: string;
  tableName: string;
}

interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  errors: string[];
}

class CRMExportService {
  // ==================== NOTION ====================

  /**
   * Exportar leads a Notion Database
   */
  async exportToNotion(
    leads: Lead[],
    config: NotionConfig
  ): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      exported: 0,
      failed: 0,
      errors: [],
    };

    if (!config.apiKey || !config.databaseId) {
      result.success = false;
      result.errors.push("Notion API Key y Database ID son requeridos");
      return result;
    }

    const client = axios.create({
      baseURL: "https://api.notion.com/v1",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });

    logger.info(`📤 Exportando ${leads.length} leads a Notion...`);

    for (const lead of leads) {
      try {
        const properties = this.buildNotionProperties(lead);

        await client.post("/pages", {
          parent: { database_id: config.databaseId },
          properties,
        });

        result.exported++;
        logger.debug(`✅ Notion: ${lead.businessName}`);
      } catch (error: any) {
        result.failed++;
        const errorMsg = error.response?.data?.message || error.message;
        result.errors.push(`${lead.businessName}: ${errorMsg}`);
        logger.warn(`❌ Notion error: ${lead.businessName} - ${errorMsg}`);
      }

      // Rate limiting: Notion permite ~3 req/s
      await this.sleep(350);
    }

    result.success = result.failed === 0;
    logger.info(
      `📤 Notion: ${result.exported} exportados, ${result.failed} fallidos`
    );

    return result;
  }

  /**
   * Construir propiedades para Notion
   */
  private buildNotionProperties(lead: Lead): Record<string, any> {
    return {
      // Title (requerido)
      Negocio: {
        title: [{ text: { content: lead.businessName } }],
      },
      // Campos de texto
      Categoría: {
        select: { name: lead.category.substring(0, 100) },
      },
      Dirección: {
        rich_text: [{ text: { content: lead.address || "" } }],
      },
      Teléfono: {
        phone_number: lead.phoneRaw || null,
      },
      Email: {
        email: lead.emails?.[0] || null,
      },
      Website: {
        url: lead.websiteUrl || null,
      },
      "Google Maps": {
        url: lead.googleMapsUrl || null,
      },
      // Números
      Rating: {
        number: lead.googleRating || null,
      },
      Reviews: {
        number: lead.reviewCount,
      },
      "Lead Score": {
        number: lead.leadScore,
      },
      // Checkbox
      "Tiene Web": {
        checkbox: lead.hasWebsite,
      },
      // Estado
      Estado: {
        select: { name: this.formatStatus(lead.outreachStatus) },
      },
      // Redes sociales
      Instagram: {
        url: lead.instagramUrl || null,
      },
      Facebook: {
        url: lead.facebookUrl || null,
      },
      // Fecha
      Fecha: {
        date: { start: lead.createdAt.toISOString().split("T")[0] },
      },
      // Tech Stack
      ...(lead.techStack && {
        "Tech Stack": {
          rich_text: [{ text: { content: lead.techStack } }],
        },
      }),
      // Notas
      ...(lead.notes && {
        Notas: {
          rich_text: [{ text: { content: lead.notes } }],
        },
      }),
    };
  }

  /**
   * Verificar conexión a Notion
   */
  async testNotionConnection(
    config: NotionConfig
  ): Promise<{ ok: boolean; error?: string; databaseName?: string }> {
    try {
      const response = await axios.get(
        `https://api.notion.com/v1/databases/${config.databaseId}`,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Notion-Version": "2022-06-28",
          },
        }
      );

      const title = response.data.title?.[0]?.plain_text || "Sin nombre";
      return { ok: true, databaseName: title };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      return { ok: false, error: msg };
    }
  }

  // ==================== AIRTABLE ====================

  /**
   * Exportar leads a Airtable
   */
  async exportToAirtable(
    leads: Lead[],
    config: AirtableConfig
  ): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      exported: 0,
      failed: 0,
      errors: [],
    };

    if (!config.apiKey || !config.baseId || !config.tableName) {
      result.success = false;
      result.errors.push(
        "Airtable API Key, Base ID y Table Name son requeridos"
      );
      return result;
    }

    const client = axios.create({
      baseURL: `https://api.airtable.com/v0/${
        config.baseId
      }/${encodeURIComponent(config.tableName)}`,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    logger.info(`📤 Exportando ${leads.length} leads a Airtable...`);

    // Airtable permite batch de 10 registros
    const batches = this.chunk(leads, 10);

    for (const batch of batches) {
      try {
        const records = batch.map((lead) => ({
          fields: this.buildAirtableFields(lead),
        }));

        await client.post("", { records });

        result.exported += batch.length;
        logger.debug(`✅ Airtable: batch de ${batch.length} exportado`);
      } catch (error: any) {
        result.failed += batch.length;
        const errorMsg = error.response?.data?.error?.message || error.message;
        result.errors.push(`Batch error: ${errorMsg}`);
        logger.warn(`❌ Airtable error: ${errorMsg}`);
      }

      // Rate limiting: Airtable permite 5 req/s
      await this.sleep(250);
    }

    result.success = result.failed === 0;
    logger.info(
      `📤 Airtable: ${result.exported} exportados, ${result.failed} fallidos`
    );

    return result;
  }

  /**
   * Construir campos para Airtable
   */
  private buildAirtableFields(lead: Lead): Record<string, any> {
    return {
      Negocio: lead.businessName,
      Categoría: lead.category,
      Dirección: lead.address || "",
      Teléfono: lead.phoneRaw || "",
      Email: lead.emails?.[0] || "",
      Website: lead.websiteUrl || "",
      "Google Maps": lead.googleMapsUrl || "",
      Rating: lead.googleRating || 0,
      Reviews: lead.reviewCount,
      "Lead Score": lead.leadScore,
      "Tiene Web": lead.hasWebsite,
      Estado: this.formatStatus(lead.outreachStatus),
      Instagram: lead.instagramUrl || "",
      Facebook: lead.facebookUrl || "",
      Fecha: lead.createdAt.toISOString().split("T")[0],
      "Tech Stack": lead.techStack || "",
      Notas: lead.notes || "",
    };
  }

  /**
   * Verificar conexión a Airtable
   */
  async testAirtableConnection(
    config: AirtableConfig
  ): Promise<{ ok: boolean; error?: string; tableName?: string }> {
    try {
      const response = await axios.get(
        `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
          config.tableName
        )}?maxRecords=1`,
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
        }
      );

      return { ok: true, tableName: config.tableName };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { ok: false, error: msg };
    }
  }

  // ==================== HELPERS ====================

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      new: "🆕 Nuevo",
      contacted: "📞 Contactado",
      responded: "💬 Respondió",
      meeting: "📅 Reunión",
      proposal: "📝 Propuesta",
      closed: "✅ Cerrado",
      lost: "❌ Perdido",
    };
    return statusMap[status] || status;
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== TEMPLATE GENERATORS ====================

  /**
   * Generar instrucciones para configurar Notion
   */
  getNotionSetupInstructions(): string {
    return `
## 🔗 Configurar Notion

### 1. Crear una integración
1. Ve a https://www.notion.so/my-integrations
2. Click "Nueva integración"
3. Nombre: "Lead Scraper"
4. Copia el "Internal Integration Token"

### 2. Crear la base de datos
Crea una base de datos en Notion con estas columnas:
- **Negocio** (Title) - Requerido
- **Categoría** (Select)
- **Dirección** (Text)
- **Teléfono** (Phone)
- **Email** (Email)
- **Website** (URL)
- **Google Maps** (URL)
- **Rating** (Number)
- **Reviews** (Number)
- **Lead Score** (Number)
- **Tiene Web** (Checkbox)
- **Estado** (Select: Nuevo, Contactado, Respondió, Reunión, Propuesta, Cerrado, Perdido)
- **Instagram** (URL)
- **Facebook** (URL)
- **Fecha** (Date)
- **Tech Stack** (Text)
- **Notas** (Text)

### 3. Conectar la integración
1. Abre tu base de datos en Notion
2. Click "..." → "Conexiones" → Agrega tu integración

### 4. Obtener el Database ID
El ID está en la URL de tu base de datos:
\`https://notion.so/[workspace]/[DATABASE_ID]?v=...\`
    `.trim();
  }

  /**
   * Generar instrucciones para configurar Airtable
   */
  getAirtableSetupInstructions(): string {
    return `
## 📊 Configurar Airtable

### 1. Obtener API Key
1. Ve a https://airtable.com/account
2. Sección "API" → "Personal access tokens"
3. Crea un token con permisos de escritura

### 2. Crear la tabla
Crea una base y tabla con estas columnas:
- **Negocio** (Single line text)
- **Categoría** (Single select)
- **Dirección** (Single line text)
- **Teléfono** (Phone)
- **Email** (Email)
- **Website** (URL)
- **Google Maps** (URL)
- **Rating** (Number, decimal)
- **Reviews** (Number, integer)
- **Lead Score** (Number, integer)
- **Tiene Web** (Checkbox)
- **Estado** (Single select)
- **Instagram** (URL)
- **Facebook** (URL)
- **Fecha** (Date)
- **Tech Stack** (Long text)
- **Notas** (Long text)

### 3. Obtener Base ID
1. Ve a https://airtable.com/api
2. Selecciona tu base
3. El Base ID comienza con "app..."

### 4. Nombre de la tabla
Usa el nombre exacto de tu tabla (ej: "Leads")
    `.trim();
  }
}

export const crmExportService = new CRMExportService();
export default crmExportService;
