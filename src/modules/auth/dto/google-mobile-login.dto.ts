import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileLoginDto {
  @ApiProperty({
    description:
      'The ID Token string received by the mobile application from Google',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOTg3YjA3...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
