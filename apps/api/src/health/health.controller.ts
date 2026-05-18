import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'tabley-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
