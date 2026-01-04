import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  checkHealth(): { ok: boolean; status: string } {
    this.logger.log('Health check requested');
    return { ok: true, status: 'up' };
  }
}
