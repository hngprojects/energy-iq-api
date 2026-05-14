import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import type { Response } from 'express';
import { WellKnownService } from './well-known.service';

@ApiTags('Well Known')
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class WellKnownController {
  constructor(private readonly wellKnownService: WellKnownService) {}

  @Public()
  @Get('assetlinks.json')
  @ApiOperation({ summary: 'Android App Links configuration' })
  getAssetLinks(@Res() res: Response): void {
    const data = this.wellKnownService.getAssetLinks();
    return void res.json(data);
  }
}
