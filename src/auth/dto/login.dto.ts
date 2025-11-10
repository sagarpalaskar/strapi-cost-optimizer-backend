import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'Email address or username',
    example: 'john@example.com',
  })
  @IsString()
  @MinLength(1)
  identifier: string;

  @ApiProperty({ 
    description: 'Password',
    example: 'password123',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
