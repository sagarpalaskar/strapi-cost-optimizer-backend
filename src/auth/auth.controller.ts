import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto, @Request() req) {
    console.log(`[AuthController] POST ${req.url || '/api/auth/register'}`);
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    console.log(`[AuthController] POST ${req.url || '/api/auth/login'}`);
    return this.authService.login(loginDto);
  }

  @UseGuards(CombinedAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User information retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Request() req) {
    console.log(`[AuthController] GET ${req.url || '/api/auth/me'}`);
    return this.authService.getCurrentUser(req.user.userId);
  }

  
  @Get('users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users (admin and editor only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getAllUsers(@Request() req) {
    console.log(`[AuthController] GET ${req.url || '/api/auth/users'}`);
    const users = await this.authService.getAllUsers();
    return { data: users };
  }

  @UseGuards(CombinedAuthGuard)
  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user and destroy all sessions' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req) {
    console.log(`[AuthController] POST ${req.url || '/api/auth/logout'}`);
    return this.authService.logout(req.user.userId);
  }

  @UseGuards(CombinedAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('sessions/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get session statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Session statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getSessionStats(@Request() req) {
    console.log(`[AuthController] GET ${req.url || '/api/auth/sessions/stats'}`);
    return this.authService.getSessionStats();
  }
}
