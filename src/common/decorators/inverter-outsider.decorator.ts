import { SetMetadata } from '@nestjs/common';

export const IS_INVERTER_OUTSIDER_KEY = 'inverterOutsider';
export const InverterOutsider = () => SetMetadata(IS_INVERTER_OUTSIDER_KEY, true);
