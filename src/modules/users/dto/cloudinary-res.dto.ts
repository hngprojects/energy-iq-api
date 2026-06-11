export class CloudinaryUploadResDto {
  asset_id: string;
  public_id: string;
  version: number;
  version_id: string;
  signature: string;
  width: number;
  height: number;
  format: string; // "png" | "pdf",
  resource_type: string; // "image",
  created_at: string;
  tags: any[];
  pages?: number;
  bytes: number; // 4247,
  type: 'upload';
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder: string;
  access_mode: string;
  existing: boolean;
}
