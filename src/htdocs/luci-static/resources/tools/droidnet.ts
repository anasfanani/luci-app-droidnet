"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";
"require rpc";

const DroidNet = baseclass.extend({
  __deviceId: null as string | null,
  __deviceConnected: null as boolean | null,
  __callRCList: rpc.declare({
    object: "rc",
    method: "list",
    params: ["name"],
    expect: {
      "": {},
    },
  }),

  __callRCInit: rpc.declare({
    object: "rc",
    method: "init",
    params: ["name", "action"],
    expect: {
      "": {},
    },
  }),

  getDeviceId: async function (): Promise<string | null> {
    if (this.__deviceId === null) {
      await uci.load("droidnet");
      this.__deviceId = uci.get("droidnet", "device", "id");
    }
    return this.__deviceId;
  },

  isDeviceConnected: async function (): Promise<boolean> {
    if (this.__deviceConnected === null) {
      const id = await this.getDeviceId();
      if (!id) {
        this.__deviceConnected = false;
        return false;
      }
      const deviceCheck = await fs.exec("adb", ["devices"]);
      this.__deviceConnected =
        deviceCheck.code === 0 && (deviceCheck.stdout?.includes(id) || false);
    }
    return this.__deviceConnected;
  },

  exec: async function (
    command: string | string[],
    options: ExecOptions = {},
  ): Promise<fs.FileExecResult> {
    const { su = false } = options;
    try {
      const id = await this.getDeviceId();
      if (!id) {
        return {
          code: 1,
          stderr: "No device ID configured",
          stdout: "",
        };
      }

      if (!(await this.isDeviceConnected())) {
        return {
          code: 1,
          stderr: "Device not connected or not found",
          stdout: "",
        };
      }
      const toArray = function (cmd: string | string[]): string[] {
        return Array.isArray(cmd) ? cmd : [String(cmd)];
      };
      const shellArgs = su
        ? ["-s", id, "shell", "su", "-c", toArray(command).join(" ")]
        : ["-s", id, "shell", ...toArray(command)];

      const result = await fs.exec("adb", shellArgs);
      return result;
    } catch (error) {
      return { code: 1, stderr: String(error), stdout: "" };
    }
  },

  getDeviceLists: async function (): Promise<DeviceList> {
    try {
      const result = await fs.exec("/usr/bin/env", [
        "HOME=/root",
        "/usr/bin/adb",
        "devices",
        "-l",
      ]);
      const devices: Record<string, string> = {};
      const stdout = (result.stdout || "").trim();
      const stderr = result.stderr;

      if (
        stderr ||
        stdout === "List of devices attached" ||
        !stdout.includes("List of devices attached")
      ) {
        return { devices: false };
      }

      const lines = stdout.split("\n").filter((line: string) => {
        return (
          !line.startsWith("*") && line.trim() !== "List of devices attached"
        );
      });

      if (lines.length > 0) {
        lines.forEach((line: string) => {
          const parts = line.split(/\s+/);
          const device = parts[0]?.trim();
          if (!device) return;
          const modelPart = parts.find((part: string) =>
            part.startsWith("model:"),
          );
          let model = device;
          if (line.includes("unauthorized")) {
            model = "unauthorized";
          } else if (modelPart) {
            model = modelPart.substring(6);
          }
          devices[device] = model;
        });
      }
      return { devices };
    } catch (error) {
      throw new Error(String(error));
    }
  },

  load: function <T>(
    loadFunction: () => Promise<T>,
  ): () => Promise<T | DeviceStatus> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return async function (): Promise<T | DeviceStatus> {
      if (!(await self.getDeviceId())) {
        return { deviceNotSet: true };
      }

      if (!(await self.isDeviceConnected())) {
        return { deviceNotConnected: true };
      }

      return await loadFunction.call(self);
    };
  },

  render: function <T>(
    renderSections:
      | ((data: T) => Array<HTMLElement[] | null>)
      | ((data: T) => Promise<Array<HTMLElement[] | null>>),
    onAfterRender?: (data: T, page: HTMLElement) => void,
  ): (data: T | DeviceStatus) => Promise<HTMLElement> {
    console.debug("[DroidNet.render] Creating render function");
    return async function (data: T | DeviceStatus): Promise<HTMLElement> {
      console.debug("[DroidNet.render] Starting render, data:", data);

      // Dynamically require UIRenderer to avoid circular dependency
      const UIRenderer = await L.require("tools/ui-renderer");
      console.debug("[DroidNet.render] UIRenderer loaded:", typeof UIRenderer);

      const deviceCheck = await UIRenderer.checkDeviceAndRender(
        data as DeviceStatus,
      );
      console.debug("[DroidNet.render] Device check result:", deviceCheck);
      if (deviceCheck) return deviceCheck;

      console.debug("[DroidNet.render] Calling renderSections");
      const sections = await renderSections(data as T);
      console.debug("[DroidNet.render] Sections:", sections);

      console.debug("[DroidNet.render] Calling renderPage");
      const page = UIRenderer.renderPage(sections);
      console.debug("[DroidNet.render] Page created:", page);

      if (onAfterRender) {
        console.debug("[DroidNet.render] Calling onAfterRender");
        onAfterRender(data as T, page);
      }

      console.debug("[DroidNet.render] Returning page");
      return page;
    };
  },

  createView: function <T>(options: {
    load: () => Promise<T>;
    render:
      | ((data: T) => Array<HTMLElement[] | null>)
      | ((data: T) => Promise<Array<HTMLElement[] | null>>);
    onAfterRender?: (data: T, page: HTMLElement) => void;
    disableHandlers?: boolean;
  }) {
    const viewConfig: Record<string, unknown> = {};

    if (!options.disableHandlers) {
      viewConfig["handleSaveApply"] = null;
      viewConfig["handleSave"] = null;
      viewConfig["handleReset"] = null;
    }

    viewConfig["load"] = this.load(options.load);
    viewConfig["render"] = this.render(options.render, options.onAfterRender);

    return viewConfig;
  },

  createSettingsManager: function <T extends Record<string, string>>(
    storageKey: string,
    fields: Record<
      keyof T,
      { elementId?: string; selector?: string; default: string }
    >,
  ) {
    const getElement = (config: {
      elementId?: string;
      selector?: string;
      default: string;
    }): HTMLElement | null => {
      if (config.elementId) return document.getElementById(config.elementId);
      if (config.selector) return document.querySelector(config.selector);
      return null;
    };

    const manager = {
      save: (): void => {
        const settings: Record<string, string> = {};
        for (const [key, config] of Object.entries(fields)) {
          const element = getElement(config);
          settings[key] =
            (element as HTMLInputElement | HTMLSelectElement)?.value ||
            config.default;
        }
        localStorage.setItem(storageKey, JSON.stringify(settings));
      },

      load: (): T => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          return JSON.parse(saved) as T;
        }
        const defaults: Record<string, string> = {};
        for (const [key, config] of Object.entries(fields)) {
          defaults[key] = config.default;
        }
        return defaults as T;
      },

      restore: (delay = 100): void => {
        setTimeout(() => {
          const settings = manager.load();
          for (const [key, config] of Object.entries(fields)) {
            const element = getElement(config);
            if (element) {
              const value = settings[key as keyof T];
              if (value !== undefined) {
                (element as HTMLInputElement | HTMLSelectElement).value = value;
              }
            }
          }
        }, delay);
      },
    };
    return manager;
  },

  reloadAdbd: async function (): Promise<fs.FileExecResult> {
    return await fs.exec("adb", ["kill-server"]);
  },

  log: function (message: string, location?: string): void {
    const logFile = "/var/log/droidnet.log";

    const currentLocation = location || L.location();
    const pathParts = currentLocation.split("/");
    const lastPart = pathParts[pathParts.length - 1] || "unknown";
    const service = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

    const date = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
    });
    const time = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const notif = `${date}, ${time} - ${service}: ${message}\n`;

    fs.exec("/usr/share/droidnet/helper", ["log", notif, logFile]);
  },

  serviceStatus: async function (): Promise<boolean> {
    return (await this.__callRCList("droidnet"))?.droidnet?.running || false;
  },

  serviceReload: function (): Promise<unknown> {
    return this.__callRCInit("droidnet", "reload");
  },

  serviceRestart: function (): Promise<unknown> {
    return this.__callRCInit("droidnet", "restart");
  },

  serviceStop: function (): Promise<unknown> {
    return this.__callRCInit("droidnet", "stop");
  },
});

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return DroidNet;
