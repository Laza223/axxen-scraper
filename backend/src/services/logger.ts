import fs from "fs";
import path from "path";
import winston from "winston";

// Crear carpeta logs si no existe
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  }
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  transports: [
    // Console con colores
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        customFormat
      ),
    }),
    // Archivo de errores
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: winston.format.combine(winston.format.json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Archivo combinado
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: winston.format.combine(winston.format.json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Archivo de scraping específico
    new winston.transports.File({
      filename: path.join(logsDir, "scraping.log"),
      level: "info",
      format: winston.format.combine(customFormat),
      maxsize: 10485760, // 10MB
      maxFiles: 3,
    }),
  ],
});

// Métodos helper para scraping
export const scrapingLogger = {
  start: (keyword: string, location: string) => {
    logger.info(`🚀 SCRAPING INICIADO`, { keyword, location });
  },
  found: (count: number) => {
    logger.info(`📍 Lugares encontrados: ${count}`);
  },
  processing: (name: string, index: number, total: number) => {
    logger.info(`⚙️  [${index}/${total}] Procesando: ${name}`);
  },
  lead: (name: string, score: number) => {
    logger.info(`✨ Lead calificado: ${name} | Score: ${score}`);
  },
  skip: (name: string, reason: string) => {
    logger.debug(`⏭️  Ignorando: ${name} | Razón: ${reason}`);
  },
  error: (context: string, error: Error) => {
    logger.error(`❌ Error en ${context}: ${error.message}`, {
      stack: error.stack,
    });
  },
  complete: (leadsCount: number, duration: number) => {
    logger.info(
      `🎯 SCRAPING COMPLETADO | ${leadsCount} leads | ${(
        duration / 1000
      ).toFixed(1)}s`
    );
  },
  api: (type: string, cost: number) => {
    logger.debug(`💰 API Call: ${type} | $${cost.toFixed(4)}`);
  },
};

export default logger;
