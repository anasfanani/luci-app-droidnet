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

  __toArray: function (cmd: string | string[]): string[] {
    return Array.isArray(cmd) ? cmd : [String(cmd)];
  },

  __exec: async function <T = fs.FileExecResult>(
    command: string | string[],
    callback?: (stdout: string) => T,
    options: ExecOptions = {},
  ): Promise<T extends undefined ? fs.FileExecResult : T> {
    const { asSu = false } = options;
    try {
      const id = await this.getDeviceId();
      if (!id) {
        return {
          code: 1,
          stderr: "No device ID configured",
          stdout: "",
        } as any;
      }

      if (!(await this.isDeviceConnected())) {
        return {
          code: 1,
          stderr: "Device not connected or not found",
          stdout: "",
        } as any;
      }

      const shellArgs = asSu
        ? ["-s", id, "shell", "su", "-c", this.__toArray(command).join(" ")]
        : ["-s", id, "shell", ...this.__toArray(command)];

      const result = await fs.exec("adb", shellArgs);
      const hadError =
        (typeof result.code === "number" && result.code !== 0) ||
        (result.stderr && result.stderr.trim().length > 0);

      if (hadError) {
        return { ...result } as any;
      }

      if (!callback) return { ...result } as any;
      const cbOut = await callback(result.stdout || "");
      return cbOut as any;
    } catch (error) {
      return { code: 1, stderr: String(error), stdout: "" } as any;
    }
  },

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

  exec: async function <T = fs.FileExecResult>(
    command: string | string[],
    callback?: (stdout: string) => T,
  ): Promise<T extends undefined ? fs.FileExecResult : T> {
    return this.__exec(command, callback, { asSu: false });
  },

  suexec: async function <T = fs.FileExecResult>(
    command: string | string[],
    callback?: (stdout: string) => T,
  ): Promise<T extends undefined ? fs.FileExecResult : T> {
    return this.__exec(command, callback, { asSu: true });
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
