# Inkwell Architecture Specification & Engineering Guide

## 1. System Overview

**Inkwell** is an architecture compiler and developer workspace built for the **iQOO Hackathon 2026 Developer Tools track**. It bridges high-level architectural design and deterministic containerized execution.

Inkwell translates a validated internal **Graph Intermediate Representation (IR)** directly into reproducible Docker Compose multi-service topologies, complete with runnable microservice templates, networking, health probes, and live telemetry.

```
+-------------------------------------------------------------+
|                      Inkwell UI                             |
|  - Architecture Canvas    - Real-time Graph Validator       |
|  - Compiler Inspector     - Container Orchestrator          |
|  - Real Telemetry Monitor - Sketch / Camera Ingestion       |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      Core Subsystems                        |
|                                                             |
|  1. Graph IR (Nodes, Edges, Metadata, Builder)              |
|  2. Graph Validator (Deterministic Rules & Integrity)       |
|  3. Deterministic Compiler (IR -> Service Templates & YAML) |
|  4. Docker Runtime Layer (Daemon Probe & Compose Invoker)   |
|  5. Telemetry & Probes (Measured Latency & Health Probes)   |
|  6. Vision Provider Abstraction (No-Mock Architecture)      |
+-------------------------------------------------------------+
```

---

## 2. Core Subsystems

### 2.1 Graph Intermediate Representation (IR)
The Graph IR (`src/core/graph/types.ts`) serves as the single source of truth for the entire pipeline.

- **Supported Node Types**:
  - `service`: HTTP API gateway or application service exposing HTTP endpoints.
  - `queue`: Message broker / queue (mapped deterministically to Redis 7).
  - `worker`: Background task processing microservice.
  - `database`: Relational or key-value persistence store (mapped deterministically to PostgreSQL 16).
- **Edges**: Directed connections representing communication paths (`source -> target`).
- **Metadata**: Unique project name, semantic version, and ISO-8601 timestamps.

### 2.2 Graph Validation Engine
Located in `src/core/validation/validator.ts`, the validation engine enforces structural invariants before compilation:
- **Node Validation**: Detects missing IDs, duplicate IDs, invalid node types, and empty labels.
- **Edge Validation**: Detects dangling edge sources, dangling edge targets, and self-referencing loops.
- **Topological Invariants**: Flags isolated/disconnected nodes in multi-node architectures.
- **Architectural Heuristics**: Emits warnings when a queue lacks producers or consumers, or when a database has no incoming writers/readers.

### 2.3 Deterministic Compiler
Located in `src/core/compiler/compiler.ts`, the compiler performs 100% reproducible translation without relying on non-deterministic LLM calls:
- Input: Validated `GraphIR`.
- Output: `CompiledProject` containing:
  - Valid `docker-compose.yml` with port allocations, healthchecks, custom bridge network (`inkwell-net`), and `depends_on` sequencing.
  - Standalone runnable Node.js service templates (`server.js`, `worker.js`, and `Dockerfile`s) exposing `/health` and `/metrics`.
  - Deterministic port allocation (Service: 4000+, Worker: 5000+, Queue: 6379, DB: 5432).

### 2.4 Docker Runtime Orchestration
Located in `src/core/runtime/`:
- `docker-detector.ts`: Truthfully probes whether Docker CLI and Docker Desktop/Engine daemon are running via `docker info`.
- `docker-runtime.ts`: Genuinely exports compiled files to disk (`.inkwell/generated/<project-name>`), starts containers (`docker compose up -d --build`), stops them (`docker compose down`), and reads statuses (`docker compose ps --format json`).
- **Strict No-Mock Policy**: If the Docker daemon is unreachable, the runtime exposes the real error and guidance rather than pretending containers are running.

### 2.5 Real Telemetry & Health Probes
Located in `src/core/telemetry/`:
- Probes each running service's HTTP healthcheck endpoint (`/health`).
- Uses `performance.now()` to measure true response latency in milliseconds.
- Captures genuine HTTP status codes and response JSON payloads.
- Truthfully marks unreachable ports as `unreachable` (e.g. `ECONNREFUSED`) instead of fabricating metrics.

### 2.6 Vision Model Provider Architecture
Located in `src/core/vision/`:
- Defines the `VisionModelProvider` interface for camera sketch ingestion.
- `Phase1VisionModelProvider`:
  - Validates real image capture from device cameras or file uploads.
  - Verifies image dimensions, format, and aspect ratio.
  - Strictly refuses to generate fake/mock graphs when no local vision model endpoint is active, safeguarding architectural integrity.

---

## 3. Canonical Architecture Vertical Slice

The canonical vertical slice implemented and verified in tests is:

$$\text{API Gateway (service)} \longrightarrow \text{Task Queue (queue)} \longrightarrow \text{Background Worker (worker)} \longrightarrow \text{Primary DB (database)}$$

This pipeline verifies end-to-end integration:
1. `api-gateway` accepts requests and publishes tasks to `task-queue`.
2. `task-queue` (Redis 7) buffers tasks.
3. `processing-worker` consumes tasks and persists results to `primary-db`.
4. `primary-db` (Postgres 16) provides persistent storage.
5. All services expose real healthchecks and telemetry endpoints.
