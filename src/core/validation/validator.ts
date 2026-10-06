import { GraphIR, isSupportedNodeType } from '../graph/types';
import { ValidationError, ValidationResult } from './types';

/**
 * Validates a Graph IR structure and returns structured errors and warnings.
 * Pure deterministic validation.
 */
export function validateGraphIR(graph: GraphIR): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!graph || !Array.isArray(graph.nodes)) {
    return {
      isValid: false,
      errors: [
        {
          code: 'EMPTY_GRAPH',
          message: 'Graph definition is empty or malformed.',
          severity: 'error',
        },
      ],
      warnings: [],
    };
  }

  if (graph.nodes.length === 0) {
    errors.push({
      code: 'EMPTY_GRAPH',
      message: 'The architecture graph has no nodes. At least one node is required to compile.',
      severity: 'error',
    });
    return { isValid: false, errors, warnings };
  }

  const nodeIds = new Set<string>();
  const duplicateIds = new Set<string>();

  // 1. Validate each node
  for (const node of graph.nodes) {
    if (!node.id || node.id.trim() === '') {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'A node is missing a required stable identifier (id).',
        severity: 'error',
        nodeId: node.id,
      });
    } else {
      if (nodeIds.has(node.id)) {
        duplicateIds.add(node.id);
      }
      nodeIds.add(node.id);
    }

    if (!node.type || !isSupportedNodeType(node.type)) {
      errors.push({
        code: 'INVALID_NODE_TYPE',
        message: `Node "${node.id || 'unknown'}" has invalid type "${node.type}". Must be one of: service, queue, worker, database.`,
        severity: 'error',
        nodeId: node.id,
      });
    }

    if (node.ports) {
      if (
        node.ports.hostPort !== undefined &&
        (isNaN(node.ports.hostPort) || node.ports.hostPort < 1 || node.ports.hostPort > 65535)
      ) {
        errors.push({
          code: 'INVALID_PORT',
          message: `Node "${node.id}" has invalid host port ${node.ports.hostPort}. Valid port range is 1-65535.`,
          severity: 'error',
          nodeId: node.id,
        });
      }
      if (
        node.ports.internalPort !== undefined &&
        (isNaN(node.ports.internalPort) || node.ports.internalPort < 1 || node.ports.internalPort > 65535)
      ) {
        errors.push({
          code: 'INVALID_PORT',
          message: `Node "${node.id}" has invalid internal port ${node.ports.internalPort}. Valid port range is 1-65535.`,
          severity: 'error',
          nodeId: node.id,
        });
      }
    }

    if (!node.label || node.label.trim() === '') {
      warnings.push({
        code: 'EMPTY_NODE_LABEL',
        message: `Node "${node.id}" has an empty label. A descriptive name is recommended.`,
        severity: 'warning',
        nodeId: node.id,
      });
    }
  }

  // Duplicate ID errors
  for (const dupId of duplicateIds) {
    errors.push({
      code: 'DUPLICATE_NODE_ID',
      message: `Duplicate node ID detected: "${dupId}". Every node must have a unique stable identifier.`,
      severity: 'error',
      nodeId: dupId,
    });
  }

  // 2. Validate edges
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();

  for (const nodeId of nodeIds) {
    incomingCount.set(nodeId, 0);
    outgoingCount.set(nodeId, 0);
  }

  for (const edge of edges) {
    if (!edge.id || edge.id.trim() === '') {
      warnings.push({
        code: 'MISSING_EDGE_ID',
        message: `Edge connecting "${edge.source}" to "${edge.target}" is missing an ID.`,
        severity: 'warning',
        edgeId: edge.id,
      });
    }

    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: 'DANGLING_EDGE_SOURCE',
        message: `Edge references non-existent source node: "${edge.source}".`,
        severity: 'error',
        edgeId: edge.id,
      });
    } else {
      outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
    }

    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: 'DANGLING_EDGE_TARGET',
        message: `Edge references non-existent target node: "${edge.target}".`,
        severity: 'error',
        edgeId: edge.id,
      });
    } else {
      incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
    }

    if (edge.source && edge.target && edge.source === edge.target) {
      warnings.push({
        code: 'SELF_REFERENCING_EDGE',
        message: `Node "${edge.source}" has a self-referencing connection. Ensure this feedback loop is intended.`,
        severity: 'warning',
        nodeId: edge.source,
        edgeId: edge.id,
      });
    }
  }

  // 3. Topology & Structural Rules
  if (graph.nodes.length > 1) {
    for (const node of graph.nodes) {
      const inDegree = incomingCount.get(node.id) || 0;
      const outDegree = outgoingCount.get(node.id) || 0;
      const totalDegree = inDegree + outDegree;

      if (totalDegree === 0) {
        errors.push({
          code: 'DISCONNECTED_NODE',
          message: `Node "${node.label || node.id}" is completely disconnected from the rest of the architecture.`,
          severity: 'error',
          nodeId: node.id,
        });
      }

      // Semantic Architecture checks
      if (node.type === 'queue') {
        if (inDegree === 0) {
          warnings.push({
            code: 'QUEUE_WITHOUT_PRODUCER',
            message: `Queue "${node.label || node.id}" has no incoming publisher/producer connections.`,
            severity: 'warning',
            nodeId: node.id,
          });
        }
        if (outDegree === 0) {
          warnings.push({
            code: 'QUEUE_WITHOUT_CONSUMER',
            message: `Queue "${node.label || node.id}" has no outgoing consumer connections.`,
            severity: 'warning',
            nodeId: node.id,
          });
        }
      }

      if (node.type === 'database') {
        if (inDegree === 0) {
          warnings.push({
            code: 'UNREACHABLE_DATABASE',
            message: `Database "${node.label || node.id}" has no incoming service/worker connections targeting it.`,
            severity: 'warning',
            nodeId: node.id,
          });
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
