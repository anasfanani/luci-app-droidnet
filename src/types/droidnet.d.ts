export interface DeviceList {
  devices: Record<string, string> | false;
}

export interface ToggleAction {
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
}

export interface TableRow {
  label: string;
  value: string | boolean;
  action?: ToggleAction;
}

export interface TabConfig {
  tabId: string;
  tabTitle: string;
  tabContent: HTMLElement;
}

export interface TableConfig {
  col?: number;
  colSizeMap?: Record<number, number[]>;
}

export interface ExecOptions {
  asSu?: boolean;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface DeviceStatus {
  deviceNotSet?: boolean;
  deviceNotConnected?: boolean;
}

export interface RCService {
  running?: boolean;
}

export type RCListResult = Record<string, RCService>;

export interface DroidNetInstance {
  getDeviceId(): Promise<string | null>;
  isDeviceConnected(): Promise<boolean>;
  exec(
    command: string | string[],
    callback?: (stdout: string) => ExecResult,
  ): Promise<ExecResult>;
  suexec(
    command: string | string[],
    callback?: (stdout: string) => ExecResult,
  ): Promise<ExecResult>;
  getDeviceLists(): Promise<DeviceList>;
  load<T>(loadFunction: () => Promise<T>): () => Promise<T | DeviceStatus>;
  reloadAdbd(): Promise<ExecResult>;
  log(message: string, location?: string): void;
  serviceStatus(): Promise<boolean>;
  serviceReload(): Promise<unknown>;
  serviceRestart(): Promise<unknown>;
  serviceStop(): Promise<unknown>;
}

export type DroidNetType = DroidNetInstance;
