# Inkwell — Architecture Compiler & Developer Workspace

Built for the **iQOO Hackathon 2026 Developer Tools track**.

Inkwell is a developer tool that provides an interactive architecture canvas, deterministic Graph IR compiler, Docker container orchestration, and real-time telemetry monitoring.

---

## 🚀 Quick Start & Development Commands

### Requirements
- **Node.js**: v20+ (tested on Node v24.21.0)
- **Package Manager**: `pnpm` exclusively (v12+)
- **Docker**: Docker CLI & Docker Desktop (optional for graph editing & compilation; required for launching containers)

### Installation
```bash
pnpm install
```

### Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Automated Tests
```bash
pnpm test
```
Runs the full Vitest suite covering Graph IR, Validator, Deterministic Compiler, Docker Runtime, Telemetry Probes, and Vision Provider.

### Typecheck & Build
```bash
pnpm typecheck
pnpm build
```

---

## 📐 Architecture & Key Subsystems

### 1. Graph Intermediate Representation (IR)
Inkwell models system architectures as directed graphs with 4 supported primitive node types:
- **`service`**: HTTP microservice / API gateway
- **`queue`**: Message broker / task queue (Redis 7)
- **`worker`**: Background processing worker
- **`database`**: Persistence store (PostgreSQL 16)

### 2. Graph Validation Engine
Performs deterministic invariant checking:
- Rejects missing or duplicate node IDs.
- Validates node types and labels.
- Rejects dangling edge endpoints and isolated nodes.
- Flags architectural smells (queues without consumers/producers).

### 3. Deterministic Compiler
- Translates validated Graph IR into runnable Docker Compose projects.
- Byte-for-byte identical output for identical graphs.
- Generates Node.js HTTP server files, worker loop files, Dockerfiles, and `docker-compose.yml`.
- Exports project files to `.inkwell/generated/<project-name>`.

### 4. Docker Runtime
- Programmatically probes whether Docker CLI and the Docker engine daemon are active.
- Controls containers via `docker compose up -d --build`, `docker compose down`, and `docker compose restart`.
- Queries real container state via `docker compose ps --format json`.
- **Zero Mocking**: If the Docker daemon is stopped, Inkwell reports the genuine error and instructions to start Docker Desktop.

### 5. Real Telemetry & Health Monitoring
- Performs actual HTTP `GET` requests to service `/health` endpoints.
- Measures high-precision latency using `performance.now()`.
- Captures actual HTTP status codes, connection errors (e.g. `ECONNREFUSED`), and JSON payloads.
- No synthetic or randomized metrics.

### 6. Sketch & Camera Input
- Real image upload and device camera video stream capture (`getUserMedia`).
- Multi-stage pipeline:
  1. `Image Captured`: Resolution, format, and byte size recorded.
  2. `Image Processed`: Dimensions verified, preprocessing verified.
  3. `Graph Extracted`: Truthfully indicates if a Vision Model Provider is active. In Phase 1, automatic graph extraction requires a configured model endpoint; no fake graphs are ever generated.

---

## 🔍 Known Limitations & Scope (Phase 1)

1. **Docker Daemon Dependency**: Container startup and lifecycle commands require Docker Desktop / Docker Engine to be running locally. If Docker is not running, the application still compiles architectures and inspects generated files, but container execution reflects the genuine unreachable daemon state.
2. **Vision Model Provider**: Phase 1 includes the complete `VisionModelProvider` interface, camera capture, and image preprocessing pipeline. Automatic handwriting recognition from sketch photos requires a deployed vision model endpoint (e.g., via `VISION_MODEL_ENDPOINT`), preserving strict data integrity.
3. **No Unverified Claims**: Phase 1 does not claim on-device NPU acceleration or markerless AR tracking until verified on physical target hardware.

---

## 📁 Repository Structure

```
├── src/
│   ├── app/                    # Next.js App Router (pages & API routes)
│   │   ├── api/                # API routes (compile, docker status, runtime, telemetry, vision)
│   │   ├── globals.css         # Design tokens, color system & grid styling
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main developer workspace
│   ├── components/             # React UI components
│   │   ├── CanvasWorkspace.tsx # Interactive architecture canvas & node editor
│   │   ├── CompilerInspector.tsx# Compiled project & Dockerfile viewer
│   │   ├── Header.tsx          # Header with live status badges
│   │   ├── HealthTelemetryPanel.tsx # Live latency and health probe table
│   │   ├── RuntimePanel.tsx    # Docker engine management & container states
│   │   ├── SketchIngestionModal.tsx # Camera & sketch upload pipeline
│   │   └── ValidationPanel.tsx # Live architectural error & warning panel
│   └── core/                   # Pure TypeScript core domain modules
│       ├── compiler/           # Deterministic compiler & templates
│       ├── graph/              # Graph IR, builder, and canonical fixtures
│       ├── runtime/            # Docker detector & compose orchestrator
│       ├── telemetry/          # Health probe collector & latency measurement
│       ├── validation/         # Graph IR validator
│       └── vision/             # VisionModelProvider interface & Phase 1 provider
├── tests/                      # Automated Vitest test suite
├── docs/                       # Technical architecture documentation
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vitest.config.ts
```

---

## 📜 License
Apache-2.0 / MIT
