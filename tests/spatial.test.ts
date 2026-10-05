import { describe, it, expect } from 'vitest';
import {
  computeHomography,
  transformPoint,
  transformBoundingBox,
  evaluateAlignmentConfidence,
  mapTelemetryToAlignedNodes,
  SpatialAlignmentEngine,
  DrawingReferenceFrame,
  AlignedNodeOverlay,
} from '../src/core/spatial/alignment';
import { TelemetryReport } from '../src/core/telemetry/types';

describe('Spatial Alignment Engine (Phase 3)', () => {
  // Test 1: Homography & Coordinate Transformation
  describe('Homography & Coordinate Transformation', () => {
    it('computes exact identity homography for identical point sets', () => {
      const pts: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const H = computeHomography(pts, pts);

      // Point (50, 50) should map to (50, 50)
      const p = transformPoint(H, { x: 50, y: 50 });
      expect(Math.round(p.x)).toBe(50);
      expect(Math.round(p.y)).toBe(50);

      // Corner (100, 100) should map to (100, 100)
      const corner = transformPoint(H, { x: 100, y: 100 });
      expect(Math.round(corner.x)).toBe(100);
      expect(Math.round(corner.y)).toBe(100);
    });

    it('correctly computes planar perspective transformation under scale and translation', () => {
      const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 500 },
        { x: 0, y: 500 },
      ];

      // Translated by (200, 300) and scaled by 0.5
      const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 200, y: 300 },
        { x: 700, y: 300 },
        { x: 700, y: 550 },
        { x: 200, y: 550 },
      ];

      const H = computeHomography(src, dst);

      // Node box inside reference: [100, 100, 200, 100]
      const nodeBox = { x: 100, y: 100, width: 200, height: 100 };
      const { bounds, center } = transformBoundingBox(H, nodeBox);

      // Expected x: 200 + 100 * 0.5 = 250, width: 200 * 0.5 = 100
      // Expected y: 300 + 100 * 0.5 = 350, height: 100 * 0.5 = 50
      expect(Math.round(bounds.x)).toBe(250);
      expect(Math.round(bounds.y)).toBe(350);
      expect(Math.round(bounds.width)).toBe(100);
      expect(Math.round(bounds.height)).toBe(50);
      expect(Math.round(center.x)).toBe(300);
      expect(Math.round(center.y)).toBe(375);
    });

    it('throws error for degenerate / collinear source points', () => {
      const collinear: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ];
      const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      expect(() => computeHomography(collinear, dst)).toThrow();
    });
  });

  // Test 2: Alignment Confidence & Reference Lost Detection
  describe('Alignment Confidence & Failure Detection', () => {
    const srcCorners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 600 },
      { x: 100, y: 600 },
    ];

    it('reports high confidence when camera framing is well-proportioned and visible', () => {
      const dstCorners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 120, y: 150 },
        { x: 880, y: 130 },
        { x: 890, y: 620 },
        { x: 110, y: 610 },
      ];

      const res = evaluateAlignmentConfidence(srcCorners, dstCorners, 1080, 2400);
      expect(res.isValid).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('detects reference lost when drawing is out of bounds or too small', () => {
      // Very tiny frame (occupying < 4% of screen)
      const tinyDst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 30 },
        { x: 10, y: 30 },
      ];

      const res = evaluateAlignmentConfidence(srcCorners, tinyDst, 1080, 2400);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('too small');
    });

    it('detects reference lost on severe perspective distortion or non-convex inversion', () => {
      // Inverted points forming a bowtie / self-intersecting polygon
      const invertedDst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 100, y: 100 },
        { x: 900, y: 600 }, // Crossed
        { x: 900, y: 100 }, // Crossed
        { x: 100, y: 600 },
      ];

      const res = evaluateAlignmentConfidence(srcCorners, invertedDst, 1080, 2400);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('non-convex');
    });
  });

  // Test 3: SpatialAlignmentEngine Lifecycle
  describe('SpatialAlignmentEngine Lifecycle', () => {
    const reference: DrawingReferenceFrame = {
      width: 1600,
      height: 1200,
      corners: [
        { x: 100, y: 100 },
        { x: 1500, y: 100 },
        { x: 1500, y: 1100 },
        { x: 100, y: 1100 },
      ],
      nodeRegions: {
        'api-gateway': { x: 200, y: 400, width: 200, height: 120 },
        'task-queue': { x: 500, y: 400, width: 200, height: 120 },
        'processing-worker': { x: 800, y: 400, width: 200, height: 120 },
        'primary-db': { x: 1100, y: 400, width: 200, height: 120 },
      },
    };

    it('returns uninitialized when no reference sketch is registered', () => {
      const engine = new SpatialAlignmentEngine();
      const res = engine.alignFrame(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        1080,
        2400
      );
      expect(res.state).toBe('uninitialized');
      expect(res.confidence).toBe(0);
    });

    it('returns aligned state and accurately projects all 4 nodes into screen coordinates', () => {
      const engine = new SpatialAlignmentEngine();
      engine.setReference(reference, {
        'api-gateway': { type: 'service', label: 'API Gateway' },
        'task-queue': { type: 'queue', label: 'Task Queue' },
        'processing-worker': { type: 'worker', label: 'Processing Worker' },
        'primary-db': { type: 'database', label: 'Primary DB' },
      });

      // Camera view at 1080x2400 with drawing centered
      const cameraCorners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
        { x: 100, y: 400 },
        { x: 980, y: 400 },
        { x: 980, y: 1800 },
        { x: 100, y: 1800 },
      ];

      const res = engine.alignFrame(cameraCorners, 1080, 2400);
      expect(res.state).toBe('aligned');
      expect(res.confidence).toBeGreaterThanOrEqual(0.7);

      // Verify all 4 nodes are projected
      expect(Object.keys(res.alignedNodes)).toEqual([
        'api-gateway',
        'task-queue',
        'processing-worker',
        'primary-db',
      ]);

      const apiNode = res.alignedNodes['api-gateway'];
      expect(apiNode.screenBounds.x).toBeGreaterThan(100);
      expect(apiNode.screenBounds.y).toBeGreaterThan(400);
      expect(apiNode.screenBounds.width).toBeGreaterThan(0);
      expect(apiNode.screenBounds.height).toBeGreaterThan(0);
    });
  });

  // Test 4: Runtime Telemetry Mapping & Failure Demonstration
  describe('Runtime Telemetry to Overlay Mapping', () => {
    const dummyOverlays: Record<string, AlignedNodeOverlay> = {
      'api-gateway': {
        nodeId: 'api-gateway',
        type: 'service',
        label: 'API Gateway',
        sourceRegion: { x: 200, y: 400, width: 200, height: 120 },
        screenQuad: [
          { x: 150, y: 450 },
          { x: 280, y: 450 },
          { x: 280, y: 550 },
          { x: 150, y: 550 },
        ],
        screenBounds: { x: 150, y: 450, width: 130, height: 100 },
        center: { x: 215, y: 500 },
      },
      'processing-worker': {
        nodeId: 'processing-worker',
        type: 'worker',
        label: 'Processing Worker',
        sourceRegion: { x: 800, y: 400, width: 200, height: 120 },
        screenQuad: [
          { x: 600, y: 450 },
          { x: 730, y: 450 },
          { x: 730, y: 550 },
          { x: 600, y: 550 },
        ],
        screenBounds: { x: 600, y: 450, width: 130, height: 100 },
        center: { x: 665, y: 500 },
      },
    };

    it('maps healthy runtime state with live latency and HTTP code', () => {
      const healthyReport: TelemetryReport = {
        timestamp: new Date().toISOString(),
        dockerAvailable: true,
        services: [
          {
            nodeId: 'api-gateway',
            serviceName: 'api-gateway',
            serviceType: 'service',
            hostPort: 3000,
            healthEndpoint: '/health',
            healthStatus: 'healthy',
            httpStatus: 200,
            latencyMs: 5.42,
            containerState: 'running',
            containerStatusText: 'Up 1 hour',
            lastChecked: new Date().toISOString(),
          },
          {
            nodeId: 'processing-worker',
            serviceName: 'processing-worker',
            serviceType: 'worker',
            hostPort: 3001,
            healthEndpoint: '/health',
            healthStatus: 'healthy',
            httpStatus: 200,
            latencyMs: 8.49,
            containerState: 'running',
            containerStatusText: 'Up 10 seconds',
            lastChecked: new Date().toISOString(),
          },
        ],
      };

      const mapped = mapTelemetryToAlignedNodes(dummyOverlays, healthyReport);

      expect(mapped['api-gateway'].runtimeState?.status).toBe('HEALTHY');
      expect(mapped['api-gateway'].runtimeState?.latencyMs).toBe(5.42);
      expect(mapped['api-gateway'].runtimeState?.httpStatus).toBe(200);

      expect(mapped['processing-worker'].runtimeState?.status).toBe('HEALTHY');
      expect(mapped['processing-worker'].runtimeState?.latencyMs).toBe(8.49);
    });

    it('accurately maps worker failure to DOWN when worker container is stopped', () => {
      const failureReport: TelemetryReport = {
        timestamp: new Date().toISOString(),
        dockerAvailable: true,
        services: [
          {
            nodeId: 'api-gateway',
            serviceName: 'api-gateway',
            serviceType: 'service',
            hostPort: 3000,
            healthEndpoint: '/health',
            healthStatus: 'healthy',
            httpStatus: 200,
            latencyMs: 6.14,
            containerState: 'running',
            containerStatusText: 'Up 1 hour',
            lastChecked: new Date().toISOString(),
          },
          {
            nodeId: 'processing-worker',
            serviceName: 'processing-worker',
            serviceType: 'worker',
            hostPort: 3001,
            healthEndpoint: '/health',
            healthStatus: 'unreachable',
            containerState: 'offline',
            containerStatusText: 'Connection refused / service unreachable',
            lastChecked: new Date().toISOString(),
            error: 'fetch failed',
          },
        ],
      };

      const mapped = mapTelemetryToAlignedNodes(dummyOverlays, failureReport);

      expect(mapped['api-gateway'].runtimeState?.status).toBe('HEALTHY');
      expect(mapped['processing-worker'].runtimeState?.status).toBe('DOWN');
      expect(mapped['processing-worker'].runtimeState?.containerState).toBe('offline');
      expect(mapped['processing-worker'].runtimeState?.details).toContain('fetch failed');
    });

    it('maps to UNKNOWN when telemetry report is null or service is unmapped', () => {
      const mapped = mapTelemetryToAlignedNodes(dummyOverlays, null);

      expect(mapped['api-gateway'].runtimeState?.status).toBe('UNKNOWN');
      expect(mapped['processing-worker'].runtimeState?.status).toBe('UNKNOWN');
    });
  });
});
