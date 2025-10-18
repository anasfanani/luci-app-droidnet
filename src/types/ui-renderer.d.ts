declare global {
  interface UITableRow {
    label: string;
    value: string | number | boolean;
    action?: UIToggleAction;
  }

  interface UITableConfig {
    col?: number;
    colSizeMap?: Record<number, number[]>;
  }

  interface UITabConfig {
    tabId: string;
    tabTitle: string;
    tabContent: HTMLElement;
  }

  interface UIToggleAction {
    onEnable: () => Promise<void>;
    onDisable: () => Promise<void>;
  }

  interface CommandResult {
    code: number;
    stdout: string;
    stderr: string;
  }

  interface ToggleOptions {
    onSuccess?: (message: string, result: CommandResult) => void;
    onFailed?: (error: string, result: CommandResult) => void;
    validator?: (result: CommandResult) => boolean;
  }

  interface DeviceFormOptions {
    devices: DeviceList;
    title?: string;
    description?: string;
    onSave: (deviceId: string) => Promise<void>;
    onReload: () => Promise<void>;
  }

  interface DeviceStatus {
    deviceNotSet?: boolean;
    deviceNotConnected?: boolean;
  }

  interface FormElement {
    value: string;
    disabled?: boolean;
    validate?: (value: string) => boolean;
    rmempty?: boolean;
    inputstyle?: string;
    cfgvalue?: string;
    write?: () => void;
    remove?: () => void;
    renderWidget?: () => HTMLElement;
    option?: (name: string, value: string) => void;
    default?: string;
    anonymous?: boolean;
  }

  interface UIRendererInstance {
    title: string;
    description: string;
    header: HTMLElement[];
    renderTable(rows: UITableRow[], config?: UITableConfig): HTMLElement;
    renderTitle(title: string): HTMLElement;
    renderTab(tabs: UITabConfig[]): HTMLElement;
    renderPage(sections: HTMLElement[][], header?: HTMLElement): HTMLElement;
    addNotification(title: string, message: string, type?: string): void;
    modalError(message: string, errorMessage?: string): void;
    modalSuccess(message: string, successMessage?: string): void;
  }
}

export {};
