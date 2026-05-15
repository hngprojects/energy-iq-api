interface VictronTag {
  idTag: number;
  name: string;
  automatic: boolean;
}

interface VictronImage {
  idSiteImage: number;
  imageName: string;
  url: string;
}

interface VictronViewPermissions {
  update_settings: boolean;
  settings: boolean;
  diagnostics: boolean;
  share: boolean;
  vnc: boolean;
  mqtt_rpc: boolean;
  vebus: boolean;
  twoway: boolean;
  exact_location: boolean;
  nodered: boolean;
  nodered_dash: boolean;
  signalk: boolean;
}

interface VictronExtendedAttribute {
  idDataAttribute: number;
  code: string;
  description: string;
  formatWithUnit: string;
  dataType: string;
  textValue: string;
  instance: string;
  timestamp: string;
  dbusServiceType: string;
  dbusPath: string;
  rawValue: string;
  formattedValue: string;
  dataAttributeEnumValues: Array<{
    nameEnum: string;
    valueEnum: number;
  }>;
}

interface VictronDiagnosticAttribute {
  idDataAttribute: number;
  code: string;
  description: string;
  formatWithUnit: string;
  dataType: string;
  rawValue: string;
  formattedValue: string;
  timestamp?: string;
}

export interface VictronDiagnosticsResponse {
  success: boolean;
  records: VictronDiagnosticAttribute[];
}

export interface VictronInstallation {
  idSite: number;
  accessLevel: number;
  owner: boolean;
  is_admin: boolean;
  name: string;
  identifier: string;
  idUser: number;
  pvMax: number;
  timezone: string;
  phonenumber: string | null;
  notes: string | null;
  geofence: string | null;
  geofenceEnabled: boolean;
  realtimeUpdates: boolean;
  restrictNodeRed: boolean;
  hasMains: number;
  hasGenerator: number;
  noDataAlarmTimeout: number | null;
  alarmMonitoring: number;
  invalidVRMAuthTokenUsedInLogRequest: number;
  syscreated: number;
  shared: boolean;
  device_icon: string;
  alarm: boolean;
  last_timestamp: number;
  current_time: string;
  timezone_offset: number;
  demo_mode: boolean;
  mqtt_webhost: string;
  mqtt_host: string;
  high_workload: boolean;
  is_on_grid: boolean;
  minimum_soc: number;
  current_alarms: string[];
  num_alarms: number;
  avatar_url: string | null;
  tags: VictronTag[];
  images: VictronImage[];
  view_permissions: VictronViewPermissions;
  extended: VictronExtendedAttribute[]; // only present with ?extended=1
}

export interface VictronInstallationsResponse {
  success: boolean;
  records: VictronInstallation[];
}

export interface MeResponse {
  success: boolean;
  record: {
    idUser: string;
    name: string;
    email: string;
  };
}
