import { IsEmail, IsString, MinLength, IsOptional, IsIn, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, USER_ROLES } from '../enums/user-role.enum';

export class RegisterDto {
  @ApiProperty({ 
    description: 'Username (minimum 3 characters)',
    example: 'johndoe',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ 
    description: 'Email address',
    example: 'john@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Password (minimum 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ 
    description: 'First name',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstname?: string;

  @ApiPropertyOptional({ 
    description: 'Last name',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  lastname?: string;

  @ApiPropertyOptional({ 
    description: 'User role',
    example: UserRole.EDITOR,
    enum: UserRole,
    default: UserRole.VIEWER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: `Role must be one of: ${USER_ROLES.join(', ')}` })
  role?: UserRole; // Defaults to 'viewer' if not provided
}
