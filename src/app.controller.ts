import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API welcome message' })
  @ApiResponse({ status: 200, description: 'Welcome message' })
  getHello(@Request() req): string {
    console.log(`[AppController] GET ${req.url || '/'}`);
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ 
    status: 200, 
    description: 'Server health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        message: { type: 'string', example: 'Backend server is running' },
        timestamp: { type: 'string', example: '2024-01-15T10:00:00.000Z' },
      },
    },
  })
  getHealth(@Request() req) {
    console.log(`[AppController] GET ${req.url || '/health'}`);
    return {
      status: 'OK',
      message: 'Backend server is running',
      timestamp: new Date().toISOString(),
    };
  }
}
