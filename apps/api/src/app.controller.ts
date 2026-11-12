import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('system')
@Public()
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API metadata' })
  @ApiOkResponse({ description: 'Service metadata and documentation links' })
  getInfo() {
    return {
      name: 'AdPilot API',
      version: '0.2.0',
      environment: process.env.NODE_ENV ?? 'development',
      docs: '/api/docs',
      health: '/api/v1/health',
      readiness: '/api/v1/health/ready',
    };
  }
}
