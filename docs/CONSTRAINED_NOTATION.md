# Inkwell Constrained Architecture Notation Specification

## Overview
Phase 2 establishes a deterministic, constrained physical sketch notation for architecture diagrams. Inkwell does not claim arbitrary or unconstrained diagram understanding; it recognizes standard system topologies drawn with well-defined geometric and semantic conventions.

---

## 1. Supported Primitives

### 1.1 Service / API Gateway (`service`)
- **Geometry**: Rectangle or rounded rectangle with aspect ratio between 1.2:1 and 4.0:1.
- **Semantic Text**: Labeled with `API`, `GATEWAY`, `SVC`, `SERVICE`, or custom endpoint name.
- **Default Port**: Host and container port `3000`.
- **Health Check**: HTTP `GET /health`.

### 1.2 Message / Task Queue (`queue`)
- **Geometry**: Horizontal rectangle or cylinder/queue symbol.
- **Semantic Text**: Labeled with `QUEUE`, `REDIS`, `MSG`, `KAFKA`, or `PUBSUB`.
- **Default Port**: Host and container port `6379`.
- **Health Check**: Native wire protocol probe (`redis-cli ping`).

### 1.3 Processing Worker (`worker`)
- **Geometry**: Rectangle with dedicated processing label.
- **Semantic Text**: Labeled with `WORKER`, `JOB`, `PROCESSOR`, or `CONSUMER`.
- **Default Port**: Host and container port `3001`.
- **Health Check**: HTTP `GET /health`.

### 1.4 Primary Database (`database`)
- **Geometry**: Vertical cylinder, database symbol, or rectangle with DB label.
- **Semantic Text**: Labeled with `DB`, `DATABASE`, `POSTGRES`, `SQL`, or `STORAGE`.
- **Default Port**: Host and container port `5432`.
- **Health Check**: Native wire protocol probe (`pg_isready`).

### 1.5 Connections (`edges`)
- **Geometry**: Directed stroke/arrow with arrowhead pointing from source node bounding box to target node bounding box.
- **Semantics**:
  - `Service -> Queue`: Publishes messages/jobs.
  - `Queue -> Worker`: Worker consumes from queue.
  - `Worker -> Database`: Worker persists results to database.
  - `Service -> Database`: Direct persistent query/storage.

---

## 2. Canonical Physical Diagram Reference

```
+---------------+        +---------------+        +---------------+        +---------------+
|      API      | -----> |     QUEUE     | -----> |    WORKER     | -----> |      DB       |
+---------------+        +---------------+        +---------------+        +---------------+
```

---

## 3. Drawing Guidelines
1. **Contrast**: Use dark ink (black or dark blue pen/marker) on light/white paper.
2. **Spacing**: Leave clear margins between node boxes and arrow shafts.
3. **Labels**: Print labels in block capital letters inside or directly above node boxes.
4. **Orientation**: Draw the pipeline horizontally (left-to-right) or vertically (top-to-bottom).
