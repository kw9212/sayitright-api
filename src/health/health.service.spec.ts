/**
 * HealthService 테스트
 *
 * 헬스체크 서비스 테스트
 * - 헬스체크 상태 반환
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe('checkHealth', () => {
    it('상태를 "up"으로 반환해야 한다', () => {
      // When: 헬스체크 실행
      const result = service.checkHealth();

      // Then: status가 "up"
      expect(result).toEqual({ status: 'up' });
    });

    it('여러 번 호출해도 항상 같은 결과를 반환해야 한다', () => {
      // When: 여러 번 호출
      const result1 = service.checkHealth();
      const result2 = service.checkHealth();
      const result3 = service.checkHealth();

      // Then: 모두 동일
      expect(result1).toEqual({ status: 'up' });
      expect(result2).toEqual({ status: 'up' });
      expect(result3).toEqual({ status: 'up' });
    });

    it('status 프로퍼티를 가져야 한다', () => {
      // When: 헬스체크 실행
      const result = service.checkHealth();

      // Then: status 프로퍼티 존재
      expect(result).toHaveProperty('status');
      expect(typeof result.status).toBe('string');
    });
  });
});
