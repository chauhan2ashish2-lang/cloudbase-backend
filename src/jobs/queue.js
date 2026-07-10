import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

export const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

export const queues = {
  publish: new Queue('publish', { connection }),
  syncInsights: new Queue('sync-insights', { connection }),
  syncAdPerformance: new Queue('sync-ad-performance', { connection }),
  optimization: new Queue('optimization', { connection }),
  tokenRefresh: new Queue('token-refresh', { connection }),
  contentGeneration: new Queue('content-generation', { connection }),
};

// Repeating jobs — call once at boot (e.g. from src/jobs/startWorkers.js)
export async function scheduleRecurringJobs() {
  await queues.syncInsights.add('hourly-sync', {}, { repeat: { every: 60 * 60 * 1000 } });
  await queues.syncAdPerformance.add('15min-sync', {}, { repeat: { every: 15 * 60 * 1000 } });
  await queues.optimization.add('hourly-optimize', {}, { repeat: { every: 60 * 60 * 1000 } });
  await queues.tokenRefresh.add('daily-refresh', {}, { repeat: { every: 24 * 60 * 60 * 1000 } });
}
