import { ApiErrorResponse } from './../types/api-error-type';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODE, type ErrorCode } from '../types/error-code';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Default values
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODE.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;

        const rawMessage = r.message;
        const rawError = r.error;

        if (typeof rawMessage === 'string') {
          message = rawMessage;
          details = null;
        } else if (Array.isArray(rawMessage)) {
          // Handle validation errors which may come as an array
          message = typeof rawError === 'string' ? rawError : 'Bad Request';
          details = rawMessage;
        } else if (typeof rawMessage === 'object' && rawMessage !== null) {
          message = typeof rawError === 'string' ? rawError : 'Bad Request';
          details = rawMessage;
        } else {
          // no message provided or unrecognized format
          message = typeof rawError === 'string' ? rawError : message;
          details = null;
        }
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          code = ERROR_CODE.BAD_REQUEST;
          break;
        case HttpStatus.UNAUTHORIZED:
          code = ERROR_CODE.UNAUTHORIZED;
          break;
        case HttpStatus.FORBIDDEN:
          code = ERROR_CODE.FORBIDDEN;
          break;
        case HttpStatus.NOT_FOUND:
          code = ERROR_CODE.NOT_FOUND;
          break;
        default:
          code = ERROR_CODE.INTERNAL_SERVER_ERROR;
          break;
      }
    }

    const body: ApiErrorResponse = {
      ok: false,
      error: { code, message, details },
    };

    response.status(status).json(body);
  }
}
