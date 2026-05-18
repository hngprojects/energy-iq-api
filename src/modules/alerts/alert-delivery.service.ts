import { Injectable } from '@nestjs/common';
import { Alert } from './entities/alert.entity';

// the purpose of this class is to queue alerts to the notification service
@Injectable()
export class AlertDeliveryService {
  deliverAlertViaWhatsapp(alert: Partial<Alert>) {
    return alert;
  }
}
