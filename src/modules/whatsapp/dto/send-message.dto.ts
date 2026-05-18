import { IsObject, IsOptional, IsString } from 'class-validator';

export class SendWhatsAppDto {
  @IsString()
  to: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  contentSid?: string;

  @IsObject()
  @IsString({ each: true })
  @IsOptional()
  contentVariables?: Record<string, string>;
}
