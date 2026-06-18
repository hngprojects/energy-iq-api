import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsEmail,
  IsNotEmptyObject,
  IsString,
  IsUUID,
} from 'class-validator';

export class UploadProfileImgDto {
  @IsDefined()
  @IsNotEmptyObject()
  file: Express.Multer.File;

  @IsUUID()
  @IsDefined()
  userId: string;

  @IsString()
  @IsEmail()
  @IsDefined()
  userEmail: string;
}
