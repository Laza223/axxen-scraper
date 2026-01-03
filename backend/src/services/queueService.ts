/**
 * 📮 QUEUE SERVICE - Sistema de Colas con Bull
 *
 * Procesa búsquedas de leads en background usando Redis.
 * Beneficios:
 * - El servidor no se bloquea durante búsquedas largas
 * - Múltiples búsquedas pueden ejecutarse en paralelo
 * - Reintentos automáticos en caso de fallo
 * - Progreso en tiempo real
 */

import Bull, { Job, Queue } from "bull";
import logger from "./logger";

// ============================================================================
// TIPOS
// ============================================================================

export interface SearchJobData {
  keyword: string;
  location: string;
  maxResults: number;
  options?: {
    forceRefresh?: boolean;
    deduplicateResults?: boolean;
    calculateQualityScore?: boolean;
    categorizeBusinesses?: boolean;
    excludeFranchises?: boolean;
    strictMatch?: boolean;
    minQualityScore?: number;
  };
  userId?: string;
  createdAt: Date;
}

export interface SearchJobResult {
  success: boolean;
  placesFound: number;
  places: any[];
  duration: number;
  error?: string;
}

export interface JobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  data: SearchJobData;
  result?: SearchJobResult;
  failedReason?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const QUEUE_CONFIG = {
  redis: REDIS_URL,
  defaultJobOptions: {
    attempts: 2, // Reintentar 2 veces si falla
    backoff: {
      type: "exponential" as const,
      delay: 5000, // 5 segundos inicial
    },
    removeOnComplete: 100, // Mantener últimos 100 completados
    removeOnFail: 50, // Mantener últimos 50 fallidos
  },
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

class QueueService {
  private searchQueue: Queue<SearchJobData> | null = null;
  private isInitialized = false;
  private processHandler:
    | ((job: Job<SearchJobData>) => Promise<SearchJobResult>)
    | null = null;

  /**
   * Inicializar el servicio de colas
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.searchQueue = new Bull<SearchJobData>("lead-searches", QUEUE_CONFIG);

      // Event handlers
      this.searchQueue.on("error", (error) => {
        logger.error(`❌ Error en cola: ${error.message}`);
      });

      this.searchQueue.on("waiting", (jobId) => {
        logger.debug(`⏳ Job ${jobId} en espera`);
      });

      this.searchQueue.on("active", (job) => {
        logger.info(
          `🚀 Job ${job.id} iniciado: ${job.data.keyword} en ${job.data.location}`
        );
      });

      this.searchQueue.on("completed", (job, result) => {
        logger.info(
          `✅ Job ${job.id} completado: ${result.placesFound} lugares en ${(
            result.duration / 1000
          ).toFixed(1)}s`
        );
      });

      this.searchQueue.on("failed", (job, error) => {
        logger.error(`❌ Job ${job.id} falló: ${error.message}`);
      });

      this.searchQueue.on("progress", (job, progress) => {
        logger.debug(`📊 Job ${job.id} progreso: ${progress}%`);
      });

      this.isInitialized = true;
      logger.info("📮 Queue Service inicializado con Bull + Redis");
    } catch (error) {
      logger.error(
        `❌ Error inicializando Queue Service: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Registrar el procesador de jobs
   * Debe llamarse después de inicializar y pasar la función que procesa búsquedas
   */
  registerProcessor(
    handler: (job: Job<SearchJobData>) => Promise<SearchJobResult>,
    concurrency: number = 2
  ): void {
    if (!this.searchQueue) {
      throw new Error("Queue no inicializada. Llama a initialize() primero.");
    }

    this.processHandler = handler;

    this.searchQueue.process(concurrency, async (job) => {
      const startTime = Date.now();

      try {
        // Actualizar progreso inicial
        await job.progress(10);

        // Ejecutar el handler
        const result = await handler(job);

        // Actualizar progreso final
        await job.progress(100);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          `❌ Error procesando job ${job.id}: ${(error as Error).message}`
        );

        return {
          success: false,
          placesFound: 0,
          places: [],
          duration,
          error: (error as Error).message,
        };
      }
    });

    logger.info(`📮 Procesador registrado con concurrencia: ${concurrency}`);
  }

  /**
   * Encolar una nueva búsqueda
   */
  async enqueueSearch(data: Omit<SearchJobData, "createdAt">): Promise<string> {
    if (!this.searchQueue) {
      await this.initialize();
    }

    const jobData: SearchJobData = {
      ...data,
      createdAt: new Date(),
    };

    const job = await this.searchQueue!.add(jobData, {
      priority: data.maxResults > 50 ? 2 : 1, // Búsquedas pequeñas tienen prioridad
    });

    logger.info(
      `📮 Búsqueda encolada: Job ${job.id} - "${data.keyword}" en "${data.location}"`
    );

    return job.id.toString();
  }

  /**
   * Obtener estado de un job
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    if (!this.searchQueue) return null;

    const job = await this.searchQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id.toString(),
      state: state as JobStatus["state"],
      progress: typeof progress === "number" ? progress : 0,
      data: job.data,
      result: job.returnvalue as SearchJobResult | undefined,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Obtener todos los jobs activos
   */
  async getActiveJobs(): Promise<JobStatus[]> {
    if (!this.searchQueue) return [];

    const jobs = await this.searchQueue.getActive();
    return Promise.all(jobs.map((job) => this.jobToStatus(job)));
  }

  /**
   * Obtener jobs en espera
   */
  async getWaitingJobs(): Promise<JobStatus[]> {
    if (!this.searchQueue) return [];

    const jobs = await this.searchQueue.getWaiting();
    return Promise.all(jobs.map((job) => this.jobToStatus(job)));
  }

  /**
   * Obtener jobs completados recientes
   */
  async getCompletedJobs(limit: number = 10): Promise<JobStatus[]> {
    if (!this.searchQueue) return [];

    const jobs = await this.searchQueue.getCompleted(0, limit - 1);
    return Promise.all(jobs.map((job) => this.jobToStatus(job)));
  }

  /**
   * Obtener jobs fallidos
   */
  async getFailedJobs(limit: number = 10): Promise<JobStatus[]> {
    if (!this.searchQueue) return [];

    const jobs = await this.searchQueue.getFailed(0, limit - 1);
    return Promise.all(jobs.map((job) => this.jobToStatus(job)));
  }

  /**
   * Cancelar un job en espera
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.searchQueue) return false;

    const job = await this.searchQueue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "waiting" || state === "delayed") {
      await job.remove();
      logger.info(`🗑️ Job ${jobId} cancelado`);
      return true;
    }

    return false;
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.searchQueue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.searchQueue.getWaitingCount(),
      this.searchQueue.getActiveCount(),
      this.searchQueue.getCompletedCount(),
      this.searchQueue.getFailedCount(),
      this.searchQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Limpiar jobs completados/fallidos
   */
  async cleanup(): Promise<void> {
    if (!this.searchQueue) return;

    await this.searchQueue.clean(3600000, "completed"); // Limpiar completados > 1 hora
    await this.searchQueue.clean(86400000, "failed"); // Limpiar fallidos > 24 horas

    logger.info("🧹 Cola limpiada");
  }

  /**
   * Cerrar la cola
   */
  async close(): Promise<void> {
    if (this.searchQueue) {
      await this.searchQueue.close();
      this.searchQueue = null;
      this.isInitialized = false;
      logger.info("📮 Queue Service cerrado");
    }
  }

  /**
   * Helper: Convertir Job a JobStatus
   */
  private async jobToStatus(job: Job<SearchJobData>): Promise<JobStatus> {
    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id.toString(),
      state: state as JobStatus["state"],
      progress: typeof progress === "number" ? progress : 0,
      data: job.data,
      result: job.returnvalue as SearchJobResult | undefined,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }
}

export const queueService = new QueueService();
export default queueService;
