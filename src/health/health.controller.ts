import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) { }
  @Get()
  health(): { ok: boolean; status: string } {
    this.logger.log('Health check endpoint called');
    return this.healthService.checkHealth();
  }
}
