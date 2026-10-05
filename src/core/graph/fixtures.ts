import { GraphIR } from './types';

/**
 * Canonical Reference Architecture:
 * API (service) -> Queue (queue) -> Worker (worker) -> Database (database)
 */
export const CANONICAL_VERTICAL_SLICE_GRAPH: GraphIR = {
  version: '1.0',
  metadata: {
    name: 'Canonical Pipeline (API -> Queue -> Worker -> DB)',
    version: '1.0.0',
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  },
  nodes: [
    {
      id: 'api-gateway',
      type: 'service',
      label: 'API Gateway',
      position: { x: 80, y: 180 },
      ports: { internalPort: 3000, hostPort: 3000 },
      env: {
        SERVICE_NAME: 'api-gateway',
        PORT: '3000',
      },
    },
    {
      id: 'task-queue',
      type: 'queue',
      label: 'Task Queue (Redis)',
      position: { x: 340, y: 180 },
      ports: { internalPort: 6379, hostPort: 6379 },
      env: {
        QUEUE_NAME: 'task-queue',
      },
    },
    {
      id: 'processing-worker',
      type: 'worker',
      label: 'Background Worker',
      position: { x: 600, y: 180 },
      ports: { internalPort: 3001, hostPort: 3001 },
      env: {
        WORKER_NAME: 'processing-worker',
        PORT: '3001',
      },
    },
    {
      id: 'primary-db',
      type: 'database',
      label: 'Primary Database (Postgres)',
      position: { x: 860, y: 180 },
      ports: { internalPort: 5432, hostPort: 5432 },
      env: {
        POSTGRES_DB: 'inkwell_db',
        POSTGRES_USER: 'inkwell_user',
        POSTGRES_PASSWORD: 'inkwell_password',
      },
    },
  ],
  edges: [
    {
      id: 'edge-api-gateway->task-queue',
      source: 'api-gateway',
      target: 'task-queue',
      label: 'publishes jobs',
    },
    {
      id: 'edge-task-queue->processing-worker',
      source: 'task-queue',
      target: 'processing-worker',
      label: 'consumes jobs',
    },
    {
      id: 'edge-processing-worker->primary-db',
      source: 'processing-worker',
      target: 'primary-db',
      label: 'persists results',
    },
  ],
};
