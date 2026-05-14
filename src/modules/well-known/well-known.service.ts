import { Injectable } from '@nestjs/common';

@Injectable()
export class WellKnownService {
  private readonly assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.hng14.energyiq',
        sha256_cert_fingerprints: [
          '69:6A:CD:C3:22:BB:9E:29:0E:01:02:B9:18:7B:11:1D:5E:1F:F9:56:57:17:7D:18:64:15:29:AF:0F:BB:72:E9',
        ],
      },
    },
  ];

  getAssetLinks() {
    return this.assetLinks;
  }
}
