"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";
"require rpc";

class DroidNet {
  private __deviceId: string | null = null;
  private __deviceConnected: boolean | null = null;
  private __callRCList = rpc.declare({
    object: "rc",
    method: "list",
    params: ["name"],
    expect: {
      "": {},
    },
  });

  private __callRCInit = rpc.declare({
    object: "rc",
    method: "init",
    params: ["name", "action"],
    expect: {
      "": {},
    },
  });

  private __toArray(cmd: string | string[]): string[] {
    return Array.isArray(cmd) ? cmd : [String(cmd)];
  }

  private async __exec(
    command: string | string[],
    callback?: (stdout: string) => any,
    { asSu = false }: { asSu?: boolean } = {},
  ): Promise<fs.FileExecResult> {
    try {
      const id = await this.getDeviceId();
      if (!id) {
        return { code: 1, stderr: "No device ID configured", stdout: "" };
      }

      if (!(await this.isDeviceConnected())) {
        return {
          code: 1,
          stderr: "Device not connected or not found",
          stdout: "",
        };
      }

      const shellArgs = asSu
        ? ["-s", id, "shell", "su", "-c", this.__toArray(command).join(" ")]
        : ["-s", id, "shell", ...this.__toArray(command)];

      const result = await fs.exec("adb", shellArgs);
      const hadError =
        (typeof result.code === "number" && result.code !== 0) ||
        (result.stderr && result.stderr.trim().length > 0);

      if (hadError) {
        return { ...result };
      }

      if (!callback) return { ...result };
      const cbOut = await callback(result.stdout || "");
      return cbOut;
    } catch (error) {
      return { code: 1, stderr: String(error), stdout: "" };
    }
  }

  async getDeviceId(): Promise<string | null> {
    if (this.__deviceId === null) {
      await uci.load("droidnet");
      this.__deviceId = uci.get("droidnet", "device", "id");
    }
    return this.__deviceId;
  }

  async isDeviceConnected(): Promise<boolean> {
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
  }

  async exec(
    command: string | string[],
    callback?: (stdout: string) => any,
  ): Promise<fs.FileExecResult> {
    return this.__exec(command, callback, { asSu: false });
  }

  async suexec(
    command: string | string[],
    callback?: (stdout: string) => any,
  ): Promise<fs.FileExecResult> {
    return this.__exec(command, callback, { asSu: true });
  }

  async getDeviceLists(): Promise<DeviceList> {
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
  }

  load(loadFunction: () => Promise<any>): () => Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return async function (this: any) {
      // Device validation guard
      if (!(await self.getDeviceId())) {
        return { deviceNotSet: true };
      }

      if (!(await self.isDeviceConnected())) {
        return { deviceNotConnected: true };
      }

      // Execute the actual load function
      return await loadFunction.call(this);
    };
  }

  async reloadAdbd(): Promise<fs.FileExecResult> {
    return await fs.exec("adb", ["kill-server"]);
  }

  log(message: string, location?: string): void {
    const logFile = "/var/log/droidnet.log";

    // Get service from URL path or provided location
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
  }

  async serviceStatus(): Promise<boolean> {
    return (await this.__callRCList("droidnet"))?.droidnet?.running || false;
  }

  serviceReload(): Promise<any> {
    return this.__callRCInit("droidnet", "reload");
  }

  serviceRestart(): Promise<any> {
    return this.__callRCInit("droidnet", "restart");
  }

  serviceStop(): Promise<any> {
    return this.__callRCInit("droidnet", "stop");
  }
}

const instance = new DroidNet();
const proto = Object.getPrototypeOf(instance);
const methods = Object.getOwnPropertyNames(proto)
  .filter(
    (name): name is keyof DroidNet =>
      name !== "constructor" &&
      typeof (instance as any)[name] === "function" &&
      !name.startsWith("_"),
  )
  .reduce(
    (obj, name) => {
      const method = instance[name] as (...args: unknown[]) => unknown;
      obj[name] = method.bind(instance);
      return obj;
    },
    {} as Record<keyof DroidNet, any>,
  );

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return baseclass.extend({
  ...instance,
  ...methods,
} as DroidNet);
