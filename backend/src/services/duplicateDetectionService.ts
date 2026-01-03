/**
 * 📊 DUPLICATE DETECTION SERVICE
 *
 * Servicio genérico para detectar duplicados inteligentemente.
 * Usa algoritmo Levenshtein para similitud de nombres + matching por teléfono/dirección.
 */

import logger from "./logger";

// ============================================================================
// INTERFACES
// ============================================================================

export interface DeduplicableItem {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  googleMapsUrl?: string;
}

export interface DuplicateMatch {
  item1: DeduplicableItem;
  item2: DeduplicableItem;
  matchType:
    | "exact_name"
    | "similar_name"
    | "same_phone"
    | "same_address"
    | "same_website";
  similarity: number; // 0-100
}

export interface DeduplicationResult<T extends DeduplicableItem> {
  unique: T[];
  duplicates: T[];
  duplicateMatches: DuplicateMatch[];
  stats: {
    original: number;
    unique: number;
    removed: number;
  };
}

// ============================================================================
// ALGORITMO LEVENSHTEIN
// ============================================================================

/**
 * Calcula la distancia de Levenshtein entre dos strings
 * (número mínimo de operaciones para convertir uno en otro)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Crear matriz de distancias
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Inicializar primera fila y columna
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Llenar la matriz
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calcula la similitud entre dos strings (0-100%)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = normalizeForComparison(str1);
  const s2 = normalizeForComparison(str2);

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Normaliza un string para comparación
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^a-z0-9]/g, "") // Solo alfanuméricos
    .trim();
}

/**
 * Normaliza un teléfono para comparación
 */
function normalizePhone(phone: string): string {
  if (!phone) return "";
  // Quitar todo excepto números
  return phone.replace(/\D/g, "");
}

/**
 * Normaliza una dirección para comparación
 */
function normalizeAddress(address: string): string {
  if (!address) return "";
  return (
    address
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Normalizar abreviaturas comunes
      .replace(/\bav\.?\b/gi, "avenida")
      .replace(/\bcalle\b/gi, "")
      .replace(/\bn°?\s*/gi, "")
      .replace(/\bpiso\s*\d+/gi, "")
      .replace(/\bdpto\.?\s*\w+/gi, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extrae dominio de una URL
 */
function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "").toLowerCase();
  } catch {
    return "";
  }
}

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class DuplicateDetectionService {
  private similarityThreshold: number = 85; // Umbral de similitud para considerar duplicado

  /**
   * Configura el umbral de similitud (0-100)
   */
  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0, Math.min(100, threshold));
  }

  /**
   * Verifica si dos items son duplicados
   */
  areDuplicates(
    item1: DeduplicableItem,
    item2: DeduplicableItem
  ): {
    isDuplicate: boolean;
    matchType: DuplicateMatch["matchType"];
    similarity: number;
  } {
    // 1. Verificar por teléfono (más confiable)
    if (item1.phone && item2.phone) {
      const phone1 = normalizePhone(item1.phone);
      const phone2 = normalizePhone(item2.phone);
      if (phone1.length >= 8 && phone1 === phone2) {
        return { isDuplicate: true, matchType: "same_phone", similarity: 100 };
      }
    }

    // 2. Verificar por website (muy confiable)
    if (item1.website && item2.website) {
      const domain1 = extractDomain(item1.website);
      const domain2 = extractDomain(item2.website);
      if (domain1 && domain1 === domain2) {
        return {
          isDuplicate: true,
          matchType: "same_website",
          similarity: 100,
        };
      }
    }

    // 3. Verificar por nombre exacto
    const name1 = normalizeForComparison(item1.name);
    const name2 = normalizeForComparison(item2.name);
    if (name1 === name2) {
      return { isDuplicate: true, matchType: "exact_name", similarity: 100 };
    }

    // 4. Verificar por similitud de nombre
    const nameSimilarity = calculateSimilarity(item1.name, item2.name);
    if (nameSimilarity >= this.similarityThreshold) {
      // Si además coincide la dirección, es muy probable duplicado
      if (item1.address && item2.address) {
        const addr1 = normalizeAddress(item1.address);
        const addr2 = normalizeAddress(item2.address);
        const addrSimilarity = calculateSimilarity(addr1, addr2);
        if (addrSimilarity >= 70) {
          return {
            isDuplicate: true,
            matchType: "same_address",
            similarity: (nameSimilarity + addrSimilarity) / 2,
          };
        }
      }

      // Si el nombre es muy similar (>90%), considerar duplicado
      if (nameSimilarity >= 90) {
        return {
          isDuplicate: true,
          matchType: "similar_name",
          similarity: nameSimilarity,
        };
      }
    }

    return {
      isDuplicate: false,
      matchType: "similar_name",
      similarity: nameSimilarity,
    };
  }

  /**
   * Deduplica un array de items
   */
  deduplicate<T extends DeduplicableItem>(items: T[]): DeduplicationResult<T> {
    const unique: T[] = [];
    const duplicates: T[] = [];
    const duplicateMatches: DuplicateMatch[] = [];
    const seen = new Set<number>(); // Índices ya procesados como duplicados

    logger.info(`🔍 Iniciando deduplicación de ${items.length} items...`);

    for (let i = 0; i < items.length; i++) {
      if (seen.has(i)) continue;

      const item = items[i];
      let isDuplicate = false;

      // Comparar con items ya marcados como únicos
      for (let j = 0; j < unique.length; j++) {
        const result = this.areDuplicates(item, unique[j]);

        if (result.isDuplicate) {
          isDuplicate = true;
          seen.add(i);
          duplicates.push(item);
          duplicateMatches.push({
            item1: unique[j],
            item2: item,
            matchType: result.matchType,
            similarity: result.similarity,
          });
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(item);
      }
    }

    const stats = {
      original: items.length,
      unique: unique.length,
      removed: duplicates.length,
    };

    logger.info(
      `✅ Deduplicación completada: ${stats.original} → ${stats.unique} únicos (${stats.removed} duplicados removidos)`
    );

    return { unique, duplicates, duplicateMatches, stats };
  }

  /**
   * Encuentra posibles duplicados en un array (sin eliminarlos)
   */
  findPossibleDuplicates<T extends DeduplicableItem>(
    items: T[]
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const result = this.areDuplicates(items[i], items[j]);
        if (result.isDuplicate) {
          matches.push({
            item1: items[i],
            item2: items[j],
            matchType: result.matchType,
            similarity: result.similarity,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Calcula la similitud entre dos nombres
   */
  getNameSimilarity(name1: string, name2: string): number {
    return calculateSimilarity(name1, name2);
  }

  /**
   * Verifica si un item ya existe en una lista
   */
  existsIn<T extends DeduplicableItem>(item: T, list: T[]): boolean {
    for (const existing of list) {
      const result = this.areDuplicates(item, existing);
      if (result.isDuplicate) {
        return true;
      }
    }
    return false;
  }

  /**
   * Merge de dos items duplicados, priorizando datos más completos
   */
  mergeItems<T extends DeduplicableItem>(item1: T, item2: T): T {
    // Clonar el primer item
    const merged = { ...item1 };

    // Agregar datos faltantes del segundo
    for (const key of Object.keys(item2) as Array<keyof T>) {
      if (!merged[key] && item2[key]) {
        (merged as any)[key] = item2[key];
      }
    }

    return merged;
  }
}

export default new DuplicateDetectionService();
