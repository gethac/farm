export type ProtocolErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ErrorEnvelope {
  message: 'error';
  requestId: string;
  error: ProtocolError;
}
