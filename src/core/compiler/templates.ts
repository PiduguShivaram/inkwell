import { GraphNode } from '../graph/types';
import { ServiceFile } from './types';

export function sanitizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Deterministic HTTP Service Template
 */
export function generateHttpServiceFiles(node: GraphNode, internalPort: number): ServiceFile[] {
  const serverCode = `// Generated deterministic HTTP Service template for "${node.label}" (${node.id})
const http = require('http');

const PORT = process.env.PORT || ${internalPort};
const SERVICE_NAME = process.env.SERVICE_NAME || '${node.label}';
const SERVICE_ID = '${node.id}';
const START_TIME = Date.now();
let requestCount = 0;

const server = http.createServer((req, res) => {
  requestCount++;
  const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      serviceId: SERVICE_ID,
      serviceName: SERVICE_NAME,
      type: 'service',
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      requestCount,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      requestCount
    }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: \`Inkwell Service '\${SERVICE_NAME}' is operational.\`,
      serviceId: SERVICE_ID,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: url.pathname }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`[Inkwell Service] \${SERVICE_NAME} listening on port \${PORT}\`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
`;

  const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY server.js ./
EXPOSE ${internalPort}
CMD ["node", "server.js"]
`;

  return [
    { path: 'server.js', content: serverCode },
    { path: 'Dockerfile', content: dockerfile },
  ];
}

/**
 * Deterministic Worker Service Template
 */
export function generateWorkerServiceFiles(node: GraphNode, internalPort: number): ServiceFile[] {
  const workerCode = `// Generated deterministic Worker Service template for "${node.label}" (${node.id})
const http = require('http');

const PORT = process.env.PORT || ${internalPort};
const WORKER_NAME = process.env.WORKER_NAME || '${node.label}';
const WORKER_ID = '${node.id}';
const QUEUE_HOST = process.env.QUEUE_HOST || 'queue';
const START_TIME = Date.now();
let jobsProcessed = 0;

// Expose health endpoint for container & telemetry probes
const server = http.createServer((req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      serviceId: WORKER_ID,
      serviceName: WORKER_NAME,
      type: 'worker',
      jobsProcessed,
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Worker endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`[Inkwell Worker] \${WORKER_NAME} health probe active on port \${PORT}\`);
});

// Periodic background work loop simulating deterministic queue polling
setInterval(() => {
  jobsProcessed++;
  console.log(\`[\${new Date().toISOString()}] \${WORKER_NAME} heartbeat: processed task #\${jobsProcessed}\`);
}, 10000);

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
`;

  const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY worker.js ./
EXPOSE ${internalPort}
CMD ["node", "worker.js"]
`;

  return [
    { path: 'worker.js', content: workerCode },
    { path: 'Dockerfile', content: dockerfile },
  ];
}
