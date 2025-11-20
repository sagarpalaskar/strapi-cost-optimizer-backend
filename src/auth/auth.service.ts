import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from './entities/user.entity';
import { SessionService } from './services/session.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [
        { email: registerDto.email },
        { username: registerDto.username },
      ],
    });

    if (existingUser) {
      throw new ConflictException('User already exists with this email or username');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = this.usersRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      firstname: registerDto.firstname || null,
      lastname: registerDto.lastname || null,
      role: registerDto.role || 'viewer', // Default to viewer if not provided (using enum value)
      blocked: false,
      confirmed: true,
    });

    // Save user to database
    const savedUser = await this.usersRepository.save(user);

    // Generate token with role
    const payload = { 
      sub: savedUser.id, 
      email: savedUser.email, 
      username: savedUser.username,
      role: savedUser.role,
    };
    const jwt = this.jwtService.sign(payload);

    // Remove password from response
    const { password, ...userWithoutPassword } = savedUser;

    // Create session
    const sessionId = this.sessionService.createSession({
      userId: savedUser.id,
      email: savedUser.email,
      username: savedUser.username,
      role: savedUser.role,
      authType: 'jwt',
    });

    return {
      jwt,
      user: userWithoutPassword,
      sessionId,
    };
  }

  async login(loginDto: LoginDto) {
    // Find user by email or username
    const user = await this.usersRepository.findOne({
      where: [
        { email: loginDto.identifier },
        { username: loginDto.identifier },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is blocked
    if (user.blocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    // Generate token with role
    const payload = { 
      sub: user.id, 
      email: user.email, 
      username: user.username,
      role: user.role,
    };
    const jwt = this.jwtService.sign(payload);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    // Create session
    const sessionId = this.sessionService.createSession({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      authType: 'jwt',
    });

    return {
      jwt,
      user: userWithoutPassword,
      sessionId,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  }

  async getAllUsers() {
    const users = await this.usersRepository.find();
    return users.map(({ password, ...user }) => user);
  }

  async logout(userId: string): Promise<{ message: string; sessionsDestroyed: number }> {
    const sessionsDestroyed = this.sessionService.destroyUserSessions(userId);
    return {
      message: 'Logged out successfully',
      sessionsDestroyed,
    };
  }

  async getSessionStats() {
    return this.sessionService.getSessionStats();
  }
}