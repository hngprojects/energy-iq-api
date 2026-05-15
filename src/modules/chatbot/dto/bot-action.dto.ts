import { IsDefined, IsEnum, IsString } from 'class-validator';
import { BotAction } from '../helpers/bot-action';

export class BotActionDto {
  @IsString()
  @IsDefined()
  @IsEnum(BotAction)
  action: BotAction;

  @IsString()
  description?: string;
}
