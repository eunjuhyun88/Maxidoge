export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server_error';

export interface PaginationMeta {
  limit: number;
  offset: number;
  total?: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  warning?: string;
  meta?: {
    pagination?: PaginationMeta;
  };
}

export interface ApiFailure {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    retryable?: boolean;
    field?: string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type LegacySuccessEnvelope<TKey extends string, TValue> = {
  success: boolean;
} & {
  [K in TKey]: TValue;
};

export interface LegacyBooleanEnvelope {
  success: boolean;
}
