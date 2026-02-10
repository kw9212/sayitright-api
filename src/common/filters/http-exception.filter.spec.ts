/**
 * HttpExceptionFilter 테스트
 *
 * HTTP 예외 필터의 에러 응답 포맷 테스트
 * - 다양한 HTTP 예외 처리
 * - 에러 코드 매핑
 * - 메시지 및 상세 정보 포맷
 * - 예상치 못한 에러 처리
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ERROR_CODE } from '../types/error-code';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    method: string;
    url: string;
    body: Record<string, unknown>;
  };

  const createMockArgumentsHost = (): ArgumentsHost => {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      method: 'GET',
      url: '/api/test',
      body: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP 예외 처리', () => {
    it('BadRequestException을 올바른 형식으로 변환해야 한다', () => {
      // Given: BadRequestException
      const exception = new BadRequestException('잘못된 요청입니다');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 올바른 형식의 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.BAD_REQUEST,
          message: '잘못된 요청입니다',
          details: null,
        },
      });
    });

    it('UnauthorizedException을 올바른 형식으로 변환해야 한다', () => {
      // Given: UnauthorizedException
      const exception = new UnauthorizedException('인증이 필요합니다');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 올바른 형식의 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.UNAUTHORIZED,
          message: '인증이 필요합니다',
          details: null,
        },
      });
    });

    it('ForbiddenException을 올바른 형식으로 변환해야 한다', () => {
      // Given: ForbiddenException
      const exception = new ForbiddenException('권한이 없습니다');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 올바른 형식의 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.FORBIDDEN,
          message: '권한이 없습니다',
          details: null,
        },
      });
    });

    it('NotFoundException을 올바른 형식으로 변환해야 한다', () => {
      // Given: NotFoundException
      const exception = new NotFoundException('리소스를 찾을 수 없습니다');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 올바른 형식의 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.NOT_FOUND,
          message: '리소스를 찾을 수 없습니다',
          details: null,
        },
      });
    });

    it('ConflictException을 올바른 형식으로 변환해야 한다', () => {
      // Given: ConflictException
      const exception = new ConflictException('이미 존재합니다');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 올바른 형식의 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.CONFLICT,
          message: '이미 존재합니다',
          details: null,
        },
      });
    });

    it('validation error (배열 메시지)를 처리해야 한다', () => {
      // Given: ValidationPipe의 에러 (배열 형식)
      const exception = new BadRequestException({
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      });
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: details에 배열이 들어감
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.BAD_REQUEST,
          message: 'Bad Request',
          details: ['email must be an email', 'password is too short'],
        },
      });
    });

    it('예상치 못한 에러는 500으로 처리해야 한다', () => {
      // Given: 일반 Error
      const exception = new Error('Unexpected error');
      const host = createMockArgumentsHost();

      // When: 필터 실행
      filter.catch(exception, host);

      // Then: 500 응답
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: ERROR_CODE.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          details: null,
        },
      });
    });
  });
});
