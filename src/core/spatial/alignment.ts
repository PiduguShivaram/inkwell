/**
 * Inkwell Spatial Image Alignment Engine
 * Phase 3: Live Drawing <-> Runtime Overlay
 * 
 * Provides deterministic planar homography, coordinate transformations,
 * reference frame tracking, and telemetry-to-overlay mapping.
 */

import { TelemetryReport, ServiceTelemetry } from '../telemetry/types';

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingReferenceFrame {
  width: number;
  height: number;
  corners: [Point2D, Point2D, Point2D, Point2D]; // [TL, TR, BR, BL]
  nodeRegions: Record<string, BoundingBox>;
}

export type AlignmentState = 'aligned' | 'reference_lost' | 'low_confidence' | 'uninitialized';

export interface AlignedNodeOverlay {
  nodeId: string;
  type: string;
  label: string;
  sourceRegion: BoundingBox;
  screenQuad: [Point2D, Point2D, Point2D, Point2D];
  screenBounds: BoundingBox;
  center: Point2D;
  runtimeState?: {
    status: 'HEALTHY' | 'DOWN' | 'UNKNOWN';
    httpStatus?: number;
    latencyMs?: number;
    containerState?: string;
    details?: string;
  };
}

export interface AlignmentResult {
  state: AlignmentState;
  confidence: number;
  message: string;
  homographyMatrix?: number[][];
  alignedNodes: Record<string, AlignedNodeOverlay>;
}

/**
 * Solves an 8-DOF planar homography matrix H (3x3) using Direct Linear Transformation (DLT)
 * mapping 4 source points to 4 destination points.
 */
export function computeHomography(
  src: [Point2D, Point2D, Point2D, Point2D],
  dst: [Point2D, Point2D, Point2D, Point2D]
): number[][] {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('Homography computation requires exactly 4 point correspondences');
  }

  // Build 8x8 linear system Ah = b where h is [h11, h12, h13, h21, h22, h23, h31, h32]^T and h33 = 1
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];

    // Row 1: x, y, 1, 0, 0, 0, -u*x, -u*y = u
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);

    // Row 2: 0, 0, 0, x, y, 1, -v*x, -v*y = v
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  // Solve Ah = b via Gaussian elimination with partial pivoting
  const h = solveLinearSystem8x8(A, b);

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * Gaussian elimination with partial pivoting for an 8x8 system
 */
function solveLinearSystem8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      throw new Error('Degenerate geometric configuration: points are collinear or invalid.');
    }

    // Eliminate below and above
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i] / M[i][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  const result: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = M[i][n] / M[i][i];
  }
  return result;
}

/**
 * Projects a 2D point using a 3x3 planar homography matrix:
 * [x', y', w']^T = H * [x, y, 1]^T
 * x_screen = x' / w', y_screen = y' / w'
 */
export function transformPoint(H: number[][], pt: Point2D): Point2D {
  const x = pt.x;
  const y = pt.y;

  const xp = H[0][0] * x + H[0][1] * y + H[0][2];
  const yp = H[1][0] * x + H[1][1] * y + H[1][2];
  const wp = H[2][0] * x + H[2][1] * y + H[2][2];

  if (Math.abs(wp) < 1e-7) {
    throw new Error('Point projected behind projective horizon / singular point');
  }

  return {
    x: xp / wp,
    y: yp / wp,
  };
}

/**
 * Transforms a rectangular bounding box into a 4-point projective quad and its axis-aligned bounding box
 */
export function transformBoundingBox(
  H: number[][],
  box: BoundingBox
): { quad: [Point2D, Point2D, Point2D, Point2D]; bounds: BoundingBox; center: Point2D } {
  const tl = transformPoint(H, { x: box.x, y: box.y });
  const tr = transformPoint(H, { x: box.x + box.width, y: box.y });
  const br = transformPoint(H, { x: box.x + box.width, y: box.y + box.height });
  const bl = transformPoint(H, { x: box.x, y: box.y + box.height });

  const minX = Math.min(tl.x, tr.x, br.x, bl.x);
  const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
  const minY = Math.min(tl.y, tr.y, br.y, bl.y);
  const maxY = Math.max(tl.y, tr.y, br.y, bl.y);

  return {
    quad: [tl, tr, br, bl],
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    center: {
      x: (tl.x + tr.x + br.x + bl.x) / 4.0,
      y: (tl.y + tr.y + br.y + bl.y) / 4.0,
    },
  };
}

/**
 * Evaluates alignment confidence based on corner geometry stability, aspect ratio, and view coverage
 */
export function evaluateAlignmentConfidence(
  srcCorners: [Point2D, Point2D, Point2D, Point2D],
  dstCorners: [Point2D, Point2D, Point2D, Point2D],
  viewWidth: number,
  viewHeight: number
): { confidence: number; isValid: boolean; reason?: string } {
  // Check bounds
  for (const pt of dstCorners) {
    if (isNaN(pt.x) || isNaN(pt.y) || !isFinite(pt.x) || !isFinite(pt.y)) {
      return { confidence: 0, isValid: false, reason: 'Invalid or non-finite coordinates' };
    }
  }

  // 1. Convexity check: all 4 cross products must have the same sign and non-zero
  const isConvex = checkConvexity(dstCorners);
  if (!isConvex) {
    return { confidence: 0.2, isValid: false, reason: 'Perspective geometry is non-convex or inverted' };
  }

  // 2. Calculate polygon area using shoelace formula
  const area = computePolygonArea(dstCorners);
  const viewArea = viewWidth * viewHeight;

  // The drawing frame should occupy between 4% and 98% of screen area to be reliably visible
  if (area < viewArea * 0.04) {
    return {
      confidence: Math.max(0.1, area / (viewArea * 0.04)),
      isValid: false,
      reason: 'Drawing too far or too small in camera frame',
    };
  }
  if (area > viewArea * 0.98) {
    return { confidence: 0.3, isValid: false, reason: 'Drawing too close or out of view bounds' };
  }

  // Aspect ratio comparison between source and destination
  const srcW = Math.hypot(srcCorners[1].x - srcCorners[0].x, srcCorners[1].y - srcCorners[0].y);
  const srcH = Math.hypot(srcCorners[3].x - srcCorners[0].x, srcCorners[3].y - srcCorners[0].y);
  const dstW = Math.hypot(dstCorners[1].x - dstCorners[0].x, dstCorners[1].y - dstCorners[0].y);
  const dstH = Math.hypot(dstCorners[3].x - dstCorners[0].x, dstCorners[3].y - dstCorners[0].y);

  const srcAspect = srcW / Math.max(1, srcH);
  const dstAspect = dstW / Math.max(1, dstH);
  const aspectDeviation = Math.abs(srcAspect - dstAspect) / srcAspect;

  if (aspectDeviation > 0.65) {
    return {
      confidence: Math.max(0.2, 1.0 - aspectDeviation),
      isValid: false,
      reason: 'Extreme perspective tilt or distorted frame',
    };
  }

  const confidence = Math.max(0.5, Math.min(0.99, 1.0 - aspectDeviation * 0.5));
  return { confidence: Number(confidence.toFixed(2)), isValid: true };
}

function computePolygonArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2.0;
}

function checkConvexity(pts: [Point2D, Point2D, Point2D, Point2D]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 4];
    const p3 = pts[(i + 2) % 4];

    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-5) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Maps live telemetry from Docker services onto aligned overlay nodes
 */
export function mapTelemetryToAlignedNodes(
  alignedNodes: Record<string, AlignedNodeOverlay>,
  telemetryReport?: TelemetryReport | null
): Record<string, AlignedNodeOverlay> {
  const result: Record<string, AlignedNodeOverlay> = {};

  const servicesMap = new Map<string, ServiceTelemetry>();
  if (telemetryReport?.services) {
    for (const s of telemetryReport.services) {
      servicesMap.set(s.nodeId, s);
      servicesMap.set(s.serviceName, s);
    }
  }

  for (const [nodeId, overlay] of Object.entries(alignedNodes)) {
    const service = servicesMap.get(nodeId);

    if (!telemetryReport || !service) {
      result[nodeId] = {
        ...overlay,
        runtimeState: {
          status: 'UNKNOWN',
          containerState: 'no telemetry',
          details: 'Awaiting runtime telemetry',
        },
      };
      continue;
    }

    const isHealthy = service.healthStatus === 'healthy' && service.containerState === 'running';

    result[nodeId] = {
      ...overlay,
      runtimeState: {
        status: isHealthy ? 'HEALTHY' : 'DOWN',
        httpStatus: service.httpStatus,
        latencyMs: service.latencyMs,
        containerState: service.containerState,
        details: isHealthy
          ? `HTTP ${service.httpStatus || 200} | ${service.latencyMs ? `${service.latencyMs.toFixed(1)}ms` : 'active'}`
          : service.error || `Container ${service.containerState}`,
      },
    };
  }

  return result;
}

/**
 * SpatialAlignmentEngine manages reference coordinates and current frame projection
 */
export class SpatialAlignmentEngine {
  private reference: DrawingReferenceFrame | null = null;
  private nodeMetadata: Record<string, { type: string; label: string }> = {};

  setReference(
    reference: DrawingReferenceFrame,
    nodeMeta?: Record<string, { type: string; label: string }>
  ): void {
    this.reference = reference;
    if (nodeMeta) {
      this.nodeMetadata = nodeMeta;
    }
  }

  getReference(): DrawingReferenceFrame | null {
    return this.reference;
  }

  alignFrame(
    currentCorners: [Point2D, Point2D, Point2D, Point2D],
    viewWidth: number,
    viewHeight: number,
    telemetry?: TelemetryReport | null
  ): AlignmentResult {
    if (!this.reference) {
      return {
        state: 'uninitialized',
        confidence: 0,
        message: 'No reference drawing registered. Scan architecture first.',
        alignedNodes: {},
      };
    }

    const evalResult = evaluateAlignmentConfidence(
      this.reference.corners,
      currentCorners,
      viewWidth,
      viewHeight
    );

    if (!evalResult.isValid) {
      return {
        state: 'reference_lost',
        confidence: evalResult.confidence,
        message: evalResult.reason ? `REALIGN DRAWING: ${evalResult.reason}` : 'REALIGN DRAWING / REFERENCE LOST',
        alignedNodes: {},
      };
    }

    let H: number[][];
    try {
      H = computeHomography(this.reference.corners, currentCorners);
    } catch {
      return {
        state: 'reference_lost',
        confidence: 0.1,
        message: 'REALIGN DRAWING / REFERENCE LOST (Degenerate perspective)',
        alignedNodes: {},
      };
    }

    const alignedNodes: Record<string, AlignedNodeOverlay> = {};

    for (const [nodeId, region] of Object.entries(this.reference.nodeRegions)) {
      try {
        const { quad, bounds, center } = transformBoundingBox(H, region);
        const meta = this.nodeMetadata[nodeId] || { type: 'service', label: nodeId };

        alignedNodes[nodeId] = {
          nodeId,
          type: meta.type,
          label: meta.label,
          sourceRegion: region,
          screenQuad: quad,
          screenBounds: bounds,
          center,
        };
      } catch {
        // Skip unprojectable nodes
      }
    }

    const finalNodes = mapTelemetryToAlignedNodes(alignedNodes, telemetry);

    return {
      state: evalResult.confidence >= 0.7 ? 'aligned' : 'low_confidence',
      confidence: evalResult.confidence,
      message: evalResult.confidence >= 0.7 ? 'Drawing aligned with live runtime' : 'Drawing partially aligned',
      homographyMatrix: H,
      alignedNodes: finalNodes,
    };
  }
}
