/**
 * SuccessResponseInterceptor 테스트
 *
 * 성공 응답 포맷 인터셉터 테스트
 * - 일반 응답을 { ok: true, data } 형식으로 wrapping
 * - undefined 응답 처리
 * - 이미 포맷된 응답은 그대로 반환
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { SuccessResponseInterceptor } from './response.interceptor';

describe('SuccessResponseInterceptor', () => {
  let interceptor: SuccessResponseInterceptor;

  const createMockExecutionContext = (): ExecutionContext => {
    return {} as ExecutionContext;
  };

  const createMockCallHandler = (data: any): CallHandler => {
    return {
      handle: () => of(data),
    } as CallHandler;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuccessResponseInterceptor],
    }).compile();

    interceptor = module.get<SuccessResponseInterceptor>(SuccessResponseInterceptor);
  });

  describe('응답 포맷 변환', () => {
    it('일반 객체를 { ok: true, data } 형식으로 wrapping해야 한다', (done) => {
      // Given: 일반 응답 데이터
      const responseData = { id: '123', name: 'test' };
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(responseData);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: wrapping됨
        expect(result).toEqual({
          ok: true,
          data: responseData,
        });
        done();
      });
    });

    it('배열을 { ok: true, data } 형식으로 wrapping해야 한다', (done) => {
      // Given: 배열 응답
      const responseData = [{ id: '1' }, { id: '2' }];
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(responseData);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: wrapping됨
        expect(result).toEqual({
          ok: true,
          data: responseData,
        });
        done();
      });
    });

    it('문자열을 { ok: true, data } 형식으로 wrapping해야 한다', (done) => {
      // Given: 문자열 응답
      const responseData = 'success message';
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(responseData);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: wrapping됨
        expect(result).toEqual({
          ok: true,
          data: responseData,
        });
        done();
      });
    });

    it('숫자를 { ok: true, data } 형식으로 wrapping해야 한다', (done) => {
      // Given: 숫자 응답
      const responseData = 42;
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(responseData);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: wrapping됨
        expect(result).toEqual({
          ok: true,
          data: responseData,
        });
        done();
      });
    });

    it('undefined는 { ok: true }만 반환해야 한다', (done) => {
      // Given: undefined 응답 (void 반환 함수)
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(undefined);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: data 없이 ok만 반환
        expect(result).toEqual({
          ok: true,
        });
        expect(result).not.toHaveProperty('data');
        done();
      });
    });

    it('이미 { ok: true, data } 형식이면 그대로 반환해야 한다', (done) => {
      // Given: 이미 포맷된 응답
      const responseData = {
        ok: true,
        data: { id: '123', name: 'test' },
      };
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(responseData);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: 그대로 반환 (중복 wrapping 안 함)
        expect(result).toEqual(responseData);
        expect(result).not.toEqual({
          ok: true,
          data: responseData, // 이렇게 중복되면 안 됨
        });
        done();
      });
    });

    it('null은 { ok: true, data: null }로 wrapping해야 한다', (done) => {
      // Given: null 응답
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(null);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: null도 wrapping됨
        expect(result).toEqual({
          ok: true,
          data: null,
        });
        done();
      });
    });

    it('boolean을 { ok: true, data: boolean }로 wrapping해야 한다', (done) => {
      // Given: boolean 응답
      const context = createMockExecutionContext();
      const handler = createMockCallHandler(false);

      // When: 인터셉터 실행
      interceptor.intercept(context, handler).subscribe((result) => {
        // Then: boolean도 wrapping됨
        expect(result).toEqual({
          ok: true,
          data: false,
        });
        done();
      });
    });
  });
});
