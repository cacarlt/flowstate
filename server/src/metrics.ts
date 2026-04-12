import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: 'todo_app_' });

// Custom metrics
export const httpRequestsTotal = new client.Counter({
  name: 'todo_app_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'todo_app_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const httpActiveRequests = new client.Gauge({
  name: 'todo_app_http_active_requests',
  help: 'Number of active HTTP requests',
});

export const adoSyncTotal = new client.Counter({
  name: 'todo_app_ado_sync_total',
  help: 'Total ADO sync operations',
  labelNames: ['status'],
});

export const githubSyncTotal = new client.Counter({
  name: 'todo_app_github_sync_total',
  help: 'Total GitHub sync operations',
  labelNames: ['status'],
});

export const dbSizeBytes = new client.Gauge({
  name: 'todo_app_db_size_bytes',
  help: 'SQLite database size in bytes',
});

export const projectCount = new client.Gauge({
  name: 'todo_app_projects_total',
  help: 'Total number of projects',
});

export const todoCount = new client.Gauge({
  name: 'todo_app_todos_total',
  help: 'Total number of todos',
  labelNames: ['status'],
});

// Middleware to track request metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') return next();

  httpActiveRequests.inc();
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    httpActiveRequests.dec();
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = normalizeRoute(req.route?.path || req.path);
    const labels = { method: req.method, route, status_code: String(res.statusCode) };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}

function normalizeRoute(path: string): string {
  // Collapse IDs to :id for cleaner metric labels
  return path.replace(/\/\d+/g, '/:id');
}

// Endpoint handler for /metrics
export async function metricsHandler(_req: Request, res: Response) {
  // Update gauge metrics on each scrape
  try {
    const { all } = await import('./db');
    const fs = await import('fs');
    const path = await import('path');

    const projects = all('SELECT COUNT(*) as count FROM projects');
    projectCount.set(projects[0]?.count || 0);

    const statuses = all('SELECT status, COUNT(*) as count FROM todos GROUP BY status');
    for (const s of statuses) {
      todoCount.set({ status: s.status }, s.count);
    }

    const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'todos.db');
    if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeBytes.set(stats.size);
    }
  } catch (_) {
    // Metrics still work even if DB queries fail
  }

  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}
