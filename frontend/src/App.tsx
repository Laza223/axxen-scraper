import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Star,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

// ==================== TIPOS ====================

interface Lead {
  id: string;
  businessName: string;
  category: string;
  address: string;
  phoneRaw?: string;
  phoneWhatsapp?: string;
  emails: string[];
  googleRating?: number;
  reviewCount: number;
  hasWebsite: boolean;
  websiteUrl?: string;
  leadScore: number;
  outreachStatus: string;
  googleMapsUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  techStack?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Sorting {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface Stats {
  total: number;
  noWebsite: number;
  highScore: number;
  avgScore: number;
  byStatus: Record<string, number>;
}

interface PremiumAlert {
  leadId: string;
  businessName: string;
  score: number;
  reasons: string[];
  priority: "high" | "medium" | "low";
  suggestedAction: string;
  estimatedValue: string;
  createdAt: string;
}

interface ZoneSaturation {
  isExhausted: boolean;
  duplicatePercentage: number;
  newLeads: number;
  duplicates: number;
}

interface _ZoneInfo {
  isLargeZone: boolean;
  originalLocation: string;
  subzonesSearched: number;
  subzones: string[];
}

// Exportar para evitar warning de unused
export type ZoneInfo = _ZoneInfo;

type ToastType = "success" | "error" | "info" | "warning" | "premium";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ==================== CONSTANTES ====================

const API_URL = "/api";

const STATUS_OPTIONS = [
  { value: "new", label: "Nuevo", color: "bg-zinc-600" },
  { value: "contacted", label: "Contactado", color: "bg-blue-600" },
  { value: "responded", label: "Respondió", color: "bg-cyan-600" },
  { value: "meeting", label: "Reunión", color: "bg-purple-600" },
  { value: "proposal", label: "Propuesta", color: "bg-orange-600" },
  { value: "closed", label: "Cerrado ✓", color: "bg-green-600" },
  { value: "lost", label: "Perdido", color: "bg-red-600" },
];

const PRESETS = [
  { keyword: "clínica estética", location: "Nordelta" },
  { keyword: "abogado", location: "Puerto Madero" },
  { keyword: "odontología", location: "Recoleta" },
  { keyword: "veterinaria", location: "Palermo" },
  { keyword: "gimnasio", location: "Belgrano" },
  { keyword: "inmobiliaria", location: "Caballito" },
  { keyword: "restaurante", location: "Polanco, CDMX" },
  { keyword: "dentista", location: "Salamanca, Madrid" },
];

const PAGE_SIZES = [25, 50, 100];

// ==================== HELPERS ====================

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-zinc-500";
};

const getStatusColor = (status: string): string => {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return opt?.color || "bg-zinc-600";
};

// Formatear teléfono para WhatsApp (quitar caracteres especiales)
const formatPhoneForWhatsApp = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
};

// ==================== TOAST COMPONENT ====================

const ToastContainer = ({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}) => (
  <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in max-w-sm ${
          toast.type === "success"
            ? "bg-green-900/90 text-green-100 border border-green-700"
            : toast.type === "error"
            ? "bg-red-900/90 text-red-100 border border-red-700"
            : toast.type === "warning"
            ? "bg-yellow-900/90 text-yellow-100 border border-yellow-700"
            : toast.type === "premium"
            ? "bg-gradient-to-r from-amber-900/90 to-orange-900/90 text-amber-100 border border-amber-600"
            : "bg-blue-900/90 text-blue-100 border border-blue-700"
        }`}
      >
        {toast.type === "premium" && (
          <Bell className="w-4 h-4 text-amber-400" />
        )}
        <span className="text-sm flex-1">{toast.message}</span>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-2 opacity-70 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
);

// ==================== SEARCH MODAL ====================

const SearchModal = ({
  isOpen,
  onClose,
  onSearch,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (
    keyword: string,
    location: string,
    maxResults: number,
    strictMatch: boolean
  ) => void;
  loading: boolean;
}) => {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(30);
  const [strictMatch, setStrictMatch] = useState(false); // 🆕 Modo estricto

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim() && location.trim()) {
      onSearch(keyword.trim(), location.trim(), maxResults, strictMatch);
    }
  };

  const handlePreset = (preset: { keyword: string; location: string }) => {
    setKeyword(preset.keyword);
    setLocation(preset.location);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Nueva Búsqueda
              </h2>
              <p className="text-xs text-zinc-500">
                Encuentra leads en Google Maps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              ¿Qué buscas?
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ej: restaurante, dentista, gimnasio..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              ¿Dónde?
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ej: Palermo, Buenos Aires"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Cantidad de resultados
            </label>
            <div className="flex gap-2">
              {MAX_RESULTS_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxResults(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    maxResults === n
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* 🆕 Toggle de modo estricto */}
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
            <div>
              <p className="text-sm font-medium text-zinc-300">
                Solo coincidencia exacta
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {strictMatch
                  ? "Solo mostrará resultados que coincidan exactamente con la categoría"
                  : "Incluye categorías relacionadas (yoga, pilates si buscas gimnasio)"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStrictMatch(!strictMatch)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                strictMatch ? "bg-emerald-600" : "bg-zinc-600"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  strictMatch ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Presets rápidos
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300"
                >
                  {preset.keyword} • {preset.location}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !keyword.trim() || !location.trim()}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl text-white font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Iniciar Búsqueda
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==================== EXPORT MODAL ====================

const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  totalLeads,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (
    type: "csv" | "notion" | "airtable",
    config?: Record<string, string>
  ) => void;
  totalLeads: number;
}) => {
  const [tab, setTab] = useState<"csv" | "notion" | "airtable">("csv");
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDbId, setNotionDbId] = useState("");
  const [airtableApiKey, setAirtableApiKey] = useState("");
  const [airtableBaseId, setAirtableBaseId] = useState("");
  const [airtableTableName, setAirtableTableName] = useState("Leads");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const endpoint =
        tab === "notion"
          ? "/api/export/notion/test"
          : "/api/export/airtable/test";
      const body =
        tab === "notion"
          ? { apiKey: notionApiKey, databaseId: notionDbId }
          : {
              apiKey: airtableApiKey,
              baseId: airtableBaseId,
              tableName: airtableTableName,
            };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok,
        message: data.ok ? `✓ Conectado` : data.error,
      });
    } catch {
      setTestResult({ ok: false, message: "Error de conexión" });
    } finally {
      setTesting(false);
    }
  };

  const handleExport = () => {
    if (tab === "csv") {
      onExport("csv");
    } else if (tab === "notion") {
      onExport("notion", { apiKey: notionApiKey, databaseId: notionDbId });
    } else {
      onExport("airtable", {
        apiKey: airtableApiKey,
        baseId: airtableBaseId,
        tableName: airtableTableName,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Exportar Leads
              </h2>
              <p className="text-xs text-zinc-500">
                {totalLeads} leads disponibles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="flex border-b border-zinc-800">
          {[
            { id: "csv" as const, label: "CSV", icon: Download },
            { id: "notion" as const, label: "Notion", icon: Database },
            { id: "airtable" as const, label: "Airtable", icon: Database },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setTestResult(null);
              }}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
                tab === t.id
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-6 space-y-4">
          {tab === "csv" && (
            <div className="text-center py-4">
              <Download className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-300">Exportar todos los leads a CSV</p>
              <p className="text-xs text-zinc-500 mt-1">
                Compatible con Excel, Google Sheets
              </p>
            </div>
          )}
          {tab === "notion" && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Integration Token
                </label>
                <input
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  placeholder="secret_..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Database ID
                </label>
                <input
                  type="text"
                  value={notionDbId}
                  onChange={(e) => setNotionDbId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}
          {tab === "airtable" && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={airtableApiKey}
                  onChange={(e) => setAirtableApiKey(e.target.value)}
                  placeholder="pat..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Base ID
                </label>
                <input
                  type="text"
                  value={airtableBaseId}
                  onChange={(e) => setAirtableBaseId(e.target.value)}
                  placeholder="app..."
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Nombre de la tabla
                </label>
                <input
                  type="text"
                  value={airtableTableName}
                  onChange={(e) => setAirtableTableName(e.target.value)}
                  placeholder="Leads"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}
          {testResult && (
            <div
              className={`px-4 py-2 rounded-lg text-sm ${
                testResult.ok
                  ? "bg-green-900/30 text-green-300 border border-green-700/50"
                  : "bg-red-900/30 text-red-300 border border-red-700/50"
              }`}
            >
              {testResult.message}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            {tab !== "csv" && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-300 flex items-center justify-center gap-2"
              >
                {testing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Probar
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={tab !== "csv" && !testResult?.ok}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== APP ====================

// Opciones de cantidad de resultados
const MAX_RESULTS_OPTIONS = [5, 10, 15, 30, 50];

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [zoneSaturation, setZoneSaturation] = useState<ZoneSaturation | null>(
    null
  );

  // 🆕 Modal states
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // 🆕 Premium alerts
  const [premiumAlerts, setPremiumAlerts] = useState<PremiumAlert[]>([]);

  // Estado de scraping en tiempo real
  const [scrapeStatus, setScrapeStatus] = useState<{
    isStreaming: boolean;
    currentZone: string;
    zoneProgress: { current: number; total: number };
    leadsFound: number;
    maxResults: number;
  } | null>(null);

  // Última búsqueda (para "Volver a scrapear")
  const [lastSearch, setLastSearch] = useState<{
    keyword: string;
    location: string;
    maxResults: number;
  } | null>(null);

  // Paginación
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Ordenamiento
  const [sorting, setSorting] = useState<Sorting>({
    sortBy: "leadScore",
    sortOrder: "desc",
  });

  // Filtros
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Toast helpers
  const addToast = (message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), type === "warning" ? 5000 : 3000);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Recargar leads cuando cambia paginación, ordenamiento o filtros
  useEffect(() => {
    loadLeads();
  }, [
    pagination.page,
    pagination.limit,
    sorting.sortBy,
    sorting.sortOrder,
    filter,
    searchText,
  ]);

  const loadStats = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${API_URL}/stats`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) setStats(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Error loading stats:", err);
      }
    }
  };

  const loadLeads = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: sorting.sortBy,
        sortOrder: sorting.sortOrder,
      });

      // Filtros backend
      if (filter === "no-website") params.append("noWebsite", "true");
      if (filter === "high-score") params.append("minScore", "70");
      // Status filters (pending, contacted, etc.)
      if (
        [
          "pending",
          "contacted",
          "interested",
          "converted",
          "rejected",
        ].includes(filter)
      ) {
        params.append("status", filter);
      }
      if (searchText.trim()) params.append("search", searchText.trim());

      const res = await fetch(`${API_URL}/leads?${params}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Error loading leads:", err);
      }
    }
  };

  // Cambiar página
  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  // Cambiar tamaño de página
  const changePageSize = (size: number) => {
    setPagination((prev) => ({ ...prev, limit: size, page: 1 }));
  };

  // Cambiar ordenamiento
  const handleSort = (field: string) => {
    setSorting((prev) => ({
      sortBy: field,
      sortOrder:
        prev.sortBy === field && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
    // Reset a página 1 al cambiar orden
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  /**
   * Scraping con streaming en tiempo real (SSE)
   */
  const handleScrape = async (
    searchKeyword: string,
    searchLocation: string,
    searchMaxResults: number = 30,
    strictMatch: boolean = false // 🆕 Modo estricto
  ) => {
    if (!searchKeyword || !searchLocation) {
      setError("Completa keyword y ubicación");
      return;
    }

    // Guardar última búsqueda
    setLastSearch({
      keyword: searchKeyword,
      location: searchLocation,
      maxResults: searchMaxResults,
    });

    setError("");
    setLoading(true);
    setZoneSaturation(null);
    setScrapeStatus({
      isStreaming: true,
      currentZone: searchLocation,
      zoneProgress: { current: 0, total: 1 },
      leadsFound: 0,
      maxResults: searchMaxResults,
    });

    // Limpiar leads anteriores para mostrar solo los nuevos en tiempo real
    const streamingLeads: Lead[] = [];

    try {
      const params = new URLSearchParams({
        keyword: searchKeyword,
        location: searchLocation,
        maxResults: searchMaxResults.toString(),
        strictMatch: strictMatch.toString(), // 🆕 Pasar modo estricto
      });

      const eventSource = new EventSource(`${API_URL}/scrape/stream?${params}`);

      await new Promise<void>((resolve, reject) => {
        eventSource.addEventListener("start", (e) => {
          const data = JSON.parse(e.data);
          setScrapeStatus((prev) =>
            prev
              ? {
                  ...prev,
                  currentZone: data.location,
                }
              : null
          );
        });

        eventSource.addEventListener("zones", (e) => {
          const data = JSON.parse(e.data);
          setScrapeStatus((prev) =>
            prev
              ? {
                  ...prev,
                  zoneProgress: { current: 0, total: data.totalZones },
                }
              : null
          );
          if (data.isLargeZone) {
            addToast(
              `🗺️ Buscando en ${data.totalZones} zonas de ${
                data.zones[0]?.split(",")[1]?.trim() || "la ciudad"
              }`,
              "info"
            );
          }
        });

        eventSource.addEventListener("zone_start", (e) => {
          const data = JSON.parse(e.data);
          setScrapeStatus((prev) =>
            prev
              ? {
                  ...prev,
                  currentZone: data.zone,
                  zoneProgress: { current: data.index, total: data.total },
                }
              : null
          );
        });

        eventSource.addEventListener("lead", (e) => {
          const data = JSON.parse(e.data);
          streamingLeads.push(data.lead);
          setLeads([...streamingLeads]);
          setScrapeStatus((prev) =>
            prev
              ? {
                  ...prev,
                  leadsFound: data.count,
                }
              : null
          );
        });

        eventSource.addEventListener("zone_complete", (e) => {
          const data = JSON.parse(e.data);
          setScrapeStatus((prev) =>
            prev
              ? {
                  ...prev,
                  zoneProgress: {
                    current: data.index,
                    total: prev.zoneProgress.total,
                  },
                  leadsFound: data.totalFound,
                }
              : null
          );
        });

        // 🆕 Premium alert listener
        eventSource.addEventListener("premium_alert", (e) => {
          const data = JSON.parse(e.data);
          const alert: PremiumAlert = data.alert;
          setPremiumAlerts((prev) => [...prev, alert]);
          addToast(`🌟 Lead Premium: ${alert.businessName}`, "premium");
        });

        eventSource.addEventListener("complete", () => {
          eventSource.close();
          addToast(`✓ ${streamingLeads.length} leads encontrados`, "success");
          resolve();
        });

        eventSource.addEventListener("error", (e) => {
          eventSource.close();
          if (e instanceof MessageEvent) {
            const data = JSON.parse(e.data);
            reject(new Error(data.message));
          } else {
            reject(new Error("Error de conexión"));
          }
        });

        eventSource.onerror = () => {
          eventSource.close();
          // Si hay leads, considerarlo éxito parcial
          if (streamingLeads.length > 0) {
            addToast(
              `⚠️ Búsqueda interrumpida, ${streamingLeads.length} leads guardados`,
              "warning"
            );
            resolve();
          } else {
            reject(new Error("Conexión perdida"));
          }
        };
      });

      // Recargar estadísticas
      await loadStats();
      setPagination((prev) => ({
        ...prev,
        page: 1,
        total: streamingLeads.length,
      }));
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
      addToast(error.message, "error");
    } finally {
      setLoading(false);
      setScrapeStatus(null);
    }
  };

  /**
   * Volver a scrapear con los valores anteriores
   */
  const handleRescrape = () => {
    if (lastSearch) {
      handleScrape(
        lastSearch.keyword,
        lastSearch.location,
        lastSearch.maxResults
      );
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachStatus: status }),
      });
      if (res.ok) {
        addToast("Estado actualizado", "success");
        loadLeads();
        loadStats();
      } else {
        addToast("Error al actualizar estado", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Error de conexión", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este lead?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("Lead eliminado", "success");
        loadLeads();
        loadStats();
      } else {
        addToast("Error al eliminar", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Error de conexión", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      addToast(`${label} copiado`, "success");
    } else {
      addToast("Error al copiar", "error");
    }
  };

  const handleExport = () => {
    window.open(`${API_URL}/export`, "_blank");
    addToast("Exportando CSV...", "info");
  };

  const handleClearAll = async () => {
    // Doble confirmación para evitar accidentes
    const confirmed = window.confirm(
      `⚠️ ¿Estás seguro que querés eliminar TODOS los ${pagination.total} leads?\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      "🗑️ ÚLTIMA CONFIRMACIÓN:\n\n¿Realmente querés borrar todo y empezar de cero?"
    );

    if (!doubleConfirm) return;

    setActionLoading("clear-all");
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        addToast(`🧹 ${data.deletedCount} leads eliminados`, "success");
        setLeads([]);
        setPagination((prev) => ({
          ...prev,
          total: 0,
          page: 1,
          totalPages: 0,
        }));
        await loadStats();
      } else {
        addToast("Error al limpiar leads", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Error de conexión", "error");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* 🆕 Modales */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSearch={(k, l, m, strict) => {
          setSearchModalOpen(false);
          handleScrape(k, l, m, strict);
        }}
        loading={loading}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        totalLeads={leads.length}
        onExport={(type, config) => {
          if (type === "csv") {
            handleExport();
          } else {
            // Para Notion/Airtable, aquí llamaríamos al backend
            addToast(`Exportando a ${type}...`, "info");
            fetch(`${API_URL}/export/${type}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.success) {
                  addToast(
                    `✓ ${data.exported} leads exportados a ${type}`,
                    "success"
                  );
                } else {
                  addToast(`Error: ${data.error}`, "error");
                }
              })
              .catch(() => addToast("Error de conexión", "error"));
          }
          setExportModalOpen(false);
        }}
      />

      {/* Header simplificado */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Lead Scraper</h1>
                <p className="text-xs text-zinc-500">v4.0 • Con modales</p>
              </div>
            </div>

            {/* Botones principales */}
            <div className="flex items-center gap-3">
              {/* Botón Buscar */}
              <button
                onClick={() => setSearchModalOpen(true)}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Buscando..." : "Nueva Búsqueda"}
              </button>

              {/* Botón Repetir */}
              {lastSearch && !loading && (
                <button
                  onClick={handleRescrape}
                  className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  title={`Repetir: "${lastSearch.keyword}" en ${lastSearch.location}`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Repetir
                </button>
              )}

              {/* Botón Exportar */}
              <button
                onClick={() => setExportModalOpen(true)}
                disabled={leads.length === 0}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-zinc-700"
              >
                <Database className="w-4 h-4" />
                Exportar
              </button>

              {/* Badge de alertas premium */}
              {premiumAlerts.length > 0 && (
                <div className="relative">
                  <button className="p-2.5 bg-amber-600/20 border border-amber-500/30 rounded-lg text-amber-400 hover:bg-amber-600/30 transition-colors">
                    <Bell className="w-4 h-4" />
                  </button>
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-zinc-900 text-xs font-bold rounded-full flex items-center justify-center">
                    {premiumAlerts.length}
                  </span>
                </div>
              )}
            </div>

            {/* Stats compactos */}
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {stats?.total || 0}
                </p>
                <p className="text-xs text-zinc-500">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {stats?.noWebsite || 0}
                </p>
                <p className="text-xs text-zinc-500">Sin Web</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {stats?.highScore || 0}
                </p>
                <p className="text-xs text-zinc-500">Score 70+</p>
              </div>
            </div>
          </div>

          {/* Barra de progreso del scraping */}
          {scrapeStatus && (
            <div className="mt-3 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span className="text-sm text-zinc-300">
                    Buscando en:{" "}
                    <span className="text-emerald-400 font-medium">
                      {scrapeStatus.currentZone}
                    </span>
                  </span>
                </div>
                <div className="text-sm text-zinc-400">
                  <span className="text-emerald-400 font-bold">
                    {scrapeStatus.leadsFound}
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    / {scrapeStatus.maxResults} leads
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (scrapeStatus.leadsFound / scrapeStatus.maxResults) * 100
                    )}%`,
                  }}
                />
              </div>
              {/* Zone progress */}
              {scrapeStatus.zoneProgress.total > 1 && (
                <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                  <span>
                    Zona {scrapeStatus.zoneProgress.current} de{" "}
                    {scrapeStatus.zoneProgress.total}
                  </span>
                  <span>
                    {Math.round(
                      (scrapeStatus.zoneProgress.current /
                        scrapeStatus.zoneProgress.total) *
                        100
                    )}
                    % zonas
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Info de última búsqueda */}
          {lastSearch && !loading && (
            <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
              <span>Última búsqueda:</span>
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                {lastSearch.keyword} • {lastSearch.location} •{" "}
                {lastSearch.maxResults} resultados
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-[1800px] mx-auto px-4 mt-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200">
            <X className="w-4 h-4" />
            {error}
            <button onClick={() => setError("")} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              placeholder="Buscar por nombre, dirección..."
              className="pl-9 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1">
            {[
              { value: "all", label: "Todos" },
              { value: "no-website", label: "🎯 Sin Web" },
              { value: "high-score", label: "⭐ Score 70+" },
              { value: "pending", label: "Pendientes" },
              { value: "contacted", label: "Contactados" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={pagination.total === 0}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>

          {/* Clear All */}
          <button
            onClick={handleClearAll}
            disabled={pagination.total === 0 || actionLoading === "clear-all"}
            className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 border border-red-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium flex items-center gap-2 text-red-300"
            title="Limpiar todos los leads para empezar de cero"
          >
            {actionLoading === "clear-all" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Limpiar Todo
          </button>

          {/* Refresh */}
          <button
            onClick={loadLeads}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>

          <span className="text-xs text-zinc-500">
            {pagination.total} leads totales
          </span>
        </div>
      </div>

      {/* Zone Saturation Warning */}
      {zoneSaturation?.isExhausted && (
        <div className="max-w-[1800px] mx-auto px-4 mb-2">
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="text-sm">
              <span className="text-yellow-200 font-medium">
                Zona saturada:
              </span>
              <span className="text-yellow-300/80 ml-2">
                {zoneSaturation.duplicatePercentage}% de resultados ya existían
                en tu base de datos. Prueba con una zona diferente o keywords
                más específicas.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="max-w-[1800px] mx-auto px-4 py-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
                  <th className="px-3 py-2 text-left font-medium w-8">#</th>
                  <th
                    className="px-3 py-2 text-left font-medium cursor-pointer hover:text-zinc-200 transition-colors"
                    onClick={() => handleSort("businessName")}
                  >
                    <span className="flex items-center gap-1">
                      Negocio
                      {sorting.sortBy === "businessName" &&
                        (sorting.sortOrder === "desc" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUp className="w-3 h-3" />
                        ))}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Categoría</th>
                  <th className="px-3 py-2 text-left font-medium">Ubicación</th>
                  <th
                    className="px-3 py-2 text-center font-medium w-16 cursor-pointer hover:text-zinc-200 transition-colors"
                    onClick={() => handleSort("googleRating")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Rating
                      {sorting.sortBy === "googleRating" &&
                        (sorting.sortOrder === "desc" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUp className="w-3 h-3" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-3 py-2 text-center font-medium w-16 cursor-pointer hover:text-zinc-200 transition-colors"
                    onClick={() => handleSort("leadScore")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Score
                      {sorting.sortBy === "leadScore" &&
                        (sorting.sortOrder === "desc" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUp className="w-3 h-3" />
                        ))}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-16">
                    Web
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Contacto</th>
                  <th className="px-3 py-2 text-left font-medium w-32">
                    Estado
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-24">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Index */}
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {(pagination.page - 1) * pagination.limit + idx + 1}
                    </td>

                    {/* Business Name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-100 truncate max-w-[200px]">
                          {lead.businessName}
                        </span>
                        {!lead.hasWebsite &&
                          !lead.instagramUrl &&
                          !lead.facebookUrl && (
                            <span className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 text-[10px] rounded">
                              🎯 SIN WEB
                            </span>
                          )}
                        {!lead.hasWebsite &&
                          (lead.instagramUrl || lead.facebookUrl) && (
                            <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-400 text-[10px] rounded">
                              📱 SOLO RRSS
                            </span>
                          )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-2 text-zinc-400 truncate max-w-[120px]">
                      {lead.category}
                    </td>

                    {/* Location */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 text-zinc-400">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {lead.address}
                        </span>
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span className="text-zinc-300">
                          {lead.googleRating?.toFixed(1) || "-"}
                        </span>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`font-bold ${getScoreColor(lead.leadScore)}`}
                      >
                        {lead.leadScore}
                      </span>
                    </td>

                    {/* Website */}
                    <td className="px-3 py-2 text-center">
                      {lead.websiteUrl ? (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Globe className="w-4 h-4 mx-auto" />
                        </a>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {lead.phoneRaw && (
                          <button
                            onClick={() =>
                              handleCopy(lead.phoneRaw!, "Teléfono")
                            }
                            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
                            title={lead.phoneRaw}
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                        )}
                        {(lead.phoneWhatsapp || lead.phoneRaw) && (
                          <a
                            href={`https://wa.me/${formatPhoneForWhatsApp(
                              lead.phoneWhatsapp || lead.phoneRaw || ""
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 hover:text-green-400"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                        {lead.emails && lead.emails.length > 0 && (
                          <button
                            onClick={() => handleCopy(lead.emails[0], "Email")}
                            className="text-zinc-400 hover:text-zinc-200"
                            title={lead.emails[0]}
                          >
                            <Mail className="w-3 h-3" />
                          </button>
                        )}
                        {lead.googleMapsUrl && (
                          <a
                            href={lead.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-zinc-200"
                            title="Google Maps"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      <select
                        value={lead.outreachStatus}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value)
                        }
                        className={`px-2 py-1 rounded text-xs font-medium text-white border-0 cursor-pointer ${getStatusColor(
                          lead.outreachStatus
                        )}`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className="bg-zinc-800"
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {lead.phoneRaw && (
                          <button
                            onClick={() =>
                              handleCopy(lead.phoneRaw!, "Teléfono")
                            }
                            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
                            title="Copiar teléfono"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(lead.id)}
                          disabled={actionLoading === lead.id}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded disabled:opacity-50"
                          title="Eliminar"
                        >
                          {actionLoading === lead.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {leads.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Buscando leads...
                        </div>
                      ) : (
                        <div>
                          <p className="text-lg mb-1">No hay leads</p>
                          <p className="text-sm">
                            Usa el buscador para scrapear negocios
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between bg-zinc-900/50">
              {/* Left: Info */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} -{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  )}{" "}
                  de {pagination.total}
                </span>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Por página:</span>
                  <select
                    value={pagination.limit}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Page Navigation */}
              <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                  onClick={() => goToPage(1)}
                  disabled={!pagination.hasPrev}
                  className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                  title="Primera página"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-3" />
                </button>

                {/* Previous */}
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1 mx-2">
                  {Array.from(
                    { length: pagination.totalPages },
                    (_, i) => i + 1
                  )
                    .filter((page) => {
                      // Show first, last, current, and 2 around current
                      const current = pagination.page;
                      return (
                        page === 1 ||
                        page === pagination.totalPages ||
                        Math.abs(page - current) <= 2
                      );
                    })
                    .map((page, idx, arr) => (
                      <span key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="text-zinc-600 px-1">...</span>
                        )}
                        <button
                          onClick={() => goToPage(page)}
                          className={`min-w-[32px] h-8 rounded text-sm font-medium transition-colors ${
                            page === pagination.page
                              ? "bg-emerald-600 text-white"
                              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    ))}
                </div>

                {/* Next */}
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  onClick={() => goToPage(pagination.totalPages)}
                  disabled={!pagination.hasNext}
                  className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400"
                  title="Última página"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
