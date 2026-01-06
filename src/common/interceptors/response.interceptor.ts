import { ApiSuccessResponse } from './../types/api-error-type';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function isSuccessResponse(value: unknown): value is { ok: true; data: unknown } {
  if (typeof value !== 'object' || value === null) return false;

  const v = value as Record<string, unknown>;

  return v.ok === true && 'data' in v;
}

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next
      .handle()
      .pipe(map((data: unknown) => (isSuccessResponse(data) ? data : { ok: true, data })));
  }
}
