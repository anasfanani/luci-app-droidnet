"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";
"require rpc";

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

class DroidNet {
  private __deviceId: string | null = null;
  private __deviceConnected: boolean | null = null;
  public title: string = _(
    `<p><strong><span style="margin-right: 5px;"><img src="/luci-static/resources/svg/droidnet.svg" style="height: 1em;width: auto;vertical-align: -0.15em;"></img></span><span style="color: rgb(102, 153, 51);">Droid</span> <span style="color: rgb(250, 197, 28);">Net</span></strong></p>`,
  );
  public description: string =
    "Manage Android modem and optimize network settings.";
  public header: HTMLElement[] = [
    E("h2", { class: "section-title" }, this.title),
    E("div", { class: "cbi-map-descr" }, _(this.description)),
  ];

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

  private __createButton(
    section: LuCI.form.NamedSection,
    id: string,
    title: string,
    text: string,
    style: "positive" | "negative" | "neutral",
    onclick: () => void | Promise<void>,
    disabled?: boolean,
  ): LuCI.form.Value {
    const o = section.option(form.DummyValue, id, title);
    o.inputstyle = style;
    o.cfgvalue = function () {
      return null;
    };
    o.write = function () {};
    o.remove = function () {};
    o.renderWidget = function () {
      const buttonStyle = this.inputstyle || "neutral";
      const attrs: Record<string, any> = {
        type: "button",
        class: `cbi-button cbi-button-${buttonStyle}`,
        value: text,
        click: onclick,
      };
      if (disabled) {
        attrs.disabled = disabled;
      }
      return E("input", attrs);
    };
    return o;
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

  async selectDevices(): Promise<DeviceList> {
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
          const model = line.includes("unauthorized")
            ? "unauthorized"
            : modelPart
              ? modelPart.substring(6)
              : device;
          devices[device] = model;
        });
      }
      return { devices };
    } catch (error) {
      throw new Error(String(error));
    }
  }

  async selectDeviceForm(): Promise<HTMLElement> {
    const getDevices: DeviceList = await this.selectDevices();
    // Mixed authorized and unauthorized devices
    // const getDevices: DeviceList = {
    //   devices: {
    //     "ABC123DEF456": "SM_G973F",
    //     "XYZ789GHI012": "unauthorized",
    //     "DEF456ABC789": "Pixel_5",
    //     "GHI012XYZ345": "unauthorized"
    //   }
    // };
    // No devices detected
    // const getDevices: DeviceList = {
    //   devices: false
    // };

    // All devices unauthorized
    // const getDevices: DeviceList = {
    //   devices: {
    //     "ABC123DEF456": "unauthorized",
    //     "XYZ789GHI012": "unauthorized"
    //   }
    // };

    console.log("Devices:", getDevices);

    let m: LuCI.form.Map, s: LuCI.form.NamedSection, o: LuCI.form.Value;

    m = new form.Map("droidnet", this.title, this.description);
    s = m.section(
      form.NamedSection,
      "device",
      "droidnet",
      _("Device Selection"),
    );
    s.anonymous = true;
    let deviceSelected: string;

    if (getDevices.devices === false) {
      o = s.option(form.DummyValue, "dummy", _("Device"));
      o.default = _("No device detected.");
    } else {
      o = s.option(form.ListValue, "id", _("Select Device ID"));
      Object.entries(getDevices.devices).forEach(
        ([deviceID, deviceModel]: [string, string]) => {
          o.value(deviceID, deviceID + " - " + deviceModel);
        },
      );
      o.validate = function (section: any, value: string): string | boolean {
        deviceSelected = value;
        const isUnauthorized: boolean =
          getDevices.devices !== false &&
          getDevices.devices[value] === "unauthorized";

        // Find and update save button
        setTimeout(() => {
          const saveBtn = document.querySelector(
            'input[value="Save Setting"]',
          ) as HTMLInputElement;
          if (saveBtn) {
            saveBtn.disabled = isUnauthorized;
          }
        }, 0);

        return isUnauthorized ? `Device ${value} is unauthorized !` : true;
      };
      o.rmempty = false;
    }

    const shouldDisable: boolean =
      getDevices.devices === false ||
      Object.values(getDevices.devices).every(
        (model: string) => model === "unauthorized",
      );

    this.__createButton(
      s,
      "save",
      _("Action"),
      _("Save Setting"),
      "positive",
      async (): Promise<void> => {
        uci.set("droidnet", "device", "id", deviceSelected);
        uci.save();
        window.location.reload();
      },
      shouldDisable,
    );

    this.__createButton(
      s,
      "reload",
      _("ADB Daemon"),
      _("⟳ Reload ADB Daemon"),
      "negative",
      async (): Promise<void> => {
        await this.reloadAdbd();
        window.location.reload();
      },
    );

    return m.render();
  }

  async reloadAdbd(): Promise<fs.FileExecResult> {
    return await fs.exec("adb", ["kill-server"]);
  }

  writeLog(message: string): void {
    const logFile = "/var/log/droidnet.log";
    fs.read(logFile).then((result: string) => {
      const service = _("Network service");
      const date = new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
      });
      const time = new Date().toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const notif = `${date}, ${time} - ${service}: ${message}`;
      const newData = result.trim() + "\n" + notif;
      return fs.write(logFile, newData);
    });
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

type DroidNetType = DroidNet;
declare const droidnet: ReturnType<() => DroidNet>;

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
      obj[name] = (instance[name] as Function).bind(instance);
      return obj;
    },
    {} as Record<keyof DroidNet, any>,
  );

// @ts-ignore
return baseclass.extend({
  ...instance,
  ...methods,
} as DroidNet);
