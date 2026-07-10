// Separate process/container from the API server — run via `npm run worker`.
// In production, split further into dedicated services (worker-publish,
// worker-analytics, worker-ads) so they scale independently.

import './publishWorker.js';
// import './syncInsightsWorker.js';
// import './syncAdPerformanceWorker.js';
// import './optimizationWorker.js';
// import './tokenRefreshWorker.js';
import { scheduleRecurringJobs } from './queue.js';

await scheduleRecurringJobs();
console.log('Workers started: publish (active), sync-insights/ads/optimization/token-refresh (stubs to implement)');
