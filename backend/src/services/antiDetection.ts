/**
 * 🛡️ SISTEMA ANTI-DETECCIÓN
 * Técnicas avanzadas para evitar bloqueos de Google Maps
 */

// Lista de User-Agents rotativos (Chrome, Firefox, Edge - versiones recientes)
export const USER_AGENTS = [
  // Chrome Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  // Chrome Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  // Firefox Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  // Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  // Safari Mac
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
];

// Resoluciones de pantalla comunes
export const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
  { width: 1680, height: 1050 },
];

// Idiomas aceptados
export const ACCEPT_LANGUAGES = [
  "es-AR,es;q=0.9,en;q=0.8",
  "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
  "es-ES,es;q=0.9,en;q=0.8",
  "es-CL,es;q=0.9",
  "es-CO,es;q=0.9,en;q=0.8",
];

/**
 * Obtener un User-Agent aleatorio
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Obtener una resolución de pantalla aleatoria
 */
export function getRandomResolution(): { width: number; height: number } {
  return SCREEN_RESOLUTIONS[
    Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)
  ];
}

/**
 * Obtener un idioma aleatorio
 */
export function getRandomLanguage(): string {
  return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

/**
 * Generar delay aleatorio humanizado (entre min y max ms)
 * Usa distribución normal para parecer más humano
 */
export function humanDelay(min: number = 500, max: number = 2000): number {
  // Distribución gaussiana para delays más naturales
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;

  let u1 = Math.random();
  let u2 = Math.random();

  // Box-Muller transform
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const delay = Math.round(mean + stdDev * z);

  return Math.max(min, Math.min(max, delay));
}

/**
 * Simular comportamiento humano de tipeo
 */
export function getTypingDelay(): number {
  // Humanos escriben entre 50-150ms por tecla
  return humanDelay(50, 150);
}

/**
 * Delay entre acciones de scroll
 */
export function getScrollDelay(): number {
  // Scroll humano: 500-1500ms entre scrolls
  return humanDelay(500, 1500);
}

/**
 * Delay antes de hacer click
 */
export function getClickDelay(): number {
  // Tiempo de "decisión" humana: 200-800ms
  return humanDelay(200, 800);
}

/**
 * Delay entre navegación a páginas diferentes
 */
export function getNavigationDelay(): number {
  // Tiempo de "lectura" entre páginas: 1-3 segundos
  return humanDelay(1000, 3000);
}

/**
 * Probabilidad de pausa larga (simular distracción humana)
 * Retorna true el 5% de las veces
 */
export function shouldTakeLongPause(): boolean {
  return Math.random() < 0.05;
}

/**
 * Pausa larga aleatoria (5-15 segundos)
 */
export function getLongPauseDelay(): number {
  return humanDelay(5000, 15000);
}

/**
 * Generar movimientos de mouse aleatorios
 */
export function getRandomMouseMovement(): { x: number; y: number } {
  return {
    x: Math.floor(Math.random() * 100) - 50,
    y: Math.floor(Math.random() * 100) - 50,
  };
}

/**
 * Headers HTTP adicionales para parecer más legítimo
 */
export function getRandomHeaders(): Record<string, string> {
  return {
    "Accept-Language": getRandomLanguage(),
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
}

/**
 * Configuración de proxy (estructura para cuando uses proxies)
 */
export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * Lista de proxies (debes agregar los tuyos)
 * Servicios recomendados: Bright Data, Oxylabs, SmartProxy
 */
export const PROXY_LIST: ProxyConfig[] = [
  // Ejemplo - reemplazar con proxies reales:
  // { host: "proxy1.example.com", port: 8080, username: "user", password: "pass" },
];

/**
 * Obtener un proxy aleatorio
 */
export function getRandomProxy(): ProxyConfig | null {
  if (PROXY_LIST.length === 0) return null;
  return PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
}

/**
 * Formatear proxy para Puppeteer
 */
export function formatProxyForPuppeteer(proxy: ProxyConfig): string {
  return `http://${proxy.host}:${proxy.port}`;
}

export default {
  getRandomUserAgent,
  getRandomResolution,
  getRandomLanguage,
  getRandomHeaders,
  humanDelay,
  getTypingDelay,
  getScrollDelay,
  getClickDelay,
  getNavigationDelay,
  shouldTakeLongPause,
  getLongPauseDelay,
  getRandomMouseMovement,
  getRandomProxy,
  formatProxyForPuppeteer,
  USER_AGENTS,
  SCREEN_RESOLUTIONS,
  PROXY_LIST,
};
