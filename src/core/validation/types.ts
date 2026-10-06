export type ValidationErrorSeverity = 'error' | 'warning';

export type ValidationErrorCode =
  | 'MISSING_NODE_ID'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_NODE_TYPE'
  | 'EMPTY_NODE_LABEL'
  | 'MISSING_EDGE_ID'
  | 'DANGLING_EDGE_SOURCE'
  | 'DANGLING_EDGE_TARGET'
  | 'SELF_REFERENCING_EDGE'
  | 'DISCONNECTED_NODE'
  | 'EMPTY_GRAPH'
  | 'INVALID_PORT'
  | 'UNREACHABLE_DATABASE'
  | 'QUEUE_WITHOUT_CONSUMER'
  | 'QUEUE_WITHOUT_PRODUCER';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  severity: ValidationErrorSeverity;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
