declare global {
  interface DeviceList {
    devices: Record<string, string> | false;
  }

  interface ToggleAction {
    onEnable: () => Promise<void>;
    onDisable: () => Promise<void>;
  }

  interface TableRow {
    label: string;
    value: string | boolean;
    action?: ToggleAction;
  }

  interface TabConfig {
    tabId: string;
    tabTitle: string;
    tabContent: HTMLElement;
  }

  interface TableConfig {
    col?: number;
    colSizeMap?: Record<number, number[]>;
  }

  interface ExecOptions {
    asSu?: boolean;
  }

  interface ExecResult {
    code: number;
    stdout: string;
    stderr: string;
  }

  interface DeviceStatus {
    deviceNotSet?: boolean;
    deviceNotConnected?: boolean;
  }

  interface RCService {
    running?: boolean;
  }

  type RCListResult = Record<string, RCService>;

  interface DroidNetInstance {
    getDeviceId(): Promise<string | null>;
    isDeviceConnected(): Promise<boolean>;
    exec<T = ExecResult>(
      command: string | string[],
      callback?: (stdout: string) => T,
    ): Promise<T>;
    suexec<T = ExecResult>(
      command: string | string[],
      callback?: (stdout: string) => T,
    ): Promise<T>;
    getDeviceLists(): Promise<DeviceList>;
    load<T>(loadFunction: () => Promise<T>): () => Promise<T | DeviceStatus>;
    reloadAdbd(): Promise<ExecResult>;
    log(message: string, location?: string): void;
    serviceStatus(): Promise<boolean>;
    serviceReload(): Promise<unknown>;
    serviceRestart(): Promise<unknown>;
    serviceStop(): Promise<unknown>;
  }

  type DroidNetType = DroidNetInstance;
}

export {};
