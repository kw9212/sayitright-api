import type { ErrorCode } from './error-code';

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
