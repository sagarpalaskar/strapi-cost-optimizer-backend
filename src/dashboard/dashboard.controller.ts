import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req) {
    console.log(`[DashboardController] GET ${req.url || '/api/dashboard/stats'}`);
    const userRole = req.user?.role || 'viewer';
    return this.dashboardService.getStats(userRole);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent activity for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Recent activity retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecentActivity(@Request() req) {
    console.log(`[DashboardController] GET ${req.url || '/api/dashboard/recent-activity'}`);
    const userRole = req.user?.role || 'viewer';
    const customUserId = req.user?.userId || null; // Get custom user ID from JWT token
    const limit = parseInt(req.query?.limit as string) || 10;
    return this.dashboardService.getRecentActivity(userRole, customUserId, limit);
  }
}
