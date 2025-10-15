"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";

interface ExecResult extends fs.FileExecResult {
  error?: boolean;
}

interface DeviceList {
  devices: Record<string, string> | false;
}

class DroidNet {
  private deviceId: string | null = null;
  public title = _(
    `<p><strong><span style="margin-right: 5px;"><img src="/luci-static/resources/svg/droidnet.svg" style="height: 1em;width: auto;vertical-align: -0.15em;"></img></span><span style="color: rgb(102, 153, 51);">Droid</span> <span style="color: rgb(250, 197, 28);">Net</span></strong></p>`,
  );
  public description = "Manage Android modem and optimize network settings.";
  public header = [
    E("h2", { class: "section-title" }, this.title),
    E("div", { class: "cbi-map-descr" }, _(this.description)),
  ];

  private toArray(cmd: string | string[]): string[] {
    return Array.isArray(cmd) ? cmd : [String(cmd)];
  }

  async getDeviceId(): Promise<string | null> {
    if (this.deviceId === null) {
      await uci.load("droidnet");
      this.deviceId = uci.get("droidnet", "device", "id");
    }
    return this.deviceId;
  }

  private async _adbExec(
    command: string | string[],
    callback?: (stdout: string) => any,
    { asSu = false }: { asSu?: boolean } = {},
  ): Promise<ExecResult | any> {
    try {
      const id = await this.getDeviceId();
      if (!id) {
        return { error: true, stderr: "No device ID configured", stdout: "" };
      }
      const shellArgs = asSu
        ? ["-s", id, "shell", "su", "-c", this.toArray(command).join(" ")]
        : ["-s", id, "shell", ...this.toArray(command)];

      const result = await fs.exec("adb", shellArgs);
      const hadError =
        (typeof result.code === "number" && result.code !== 0) ||
        (result.stderr && result.stderr.trim().length > 0);

      if (hadError) {
        return { ...result, error: true };
      }

      if (!callback) return { ...result, error: false };
      const cbOut = await callback(result.stdout || "");
      return cbOut;
    } catch (error) {
      return { error: true, stderr: String(error), stdout: "" };
    }
  }

  private createButton(
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

  async exec(
    command: string | string[],
    callback?: (stdout: string) => any,
  ): Promise<ExecResult | any> {
    return this._adbExec(command, callback, { asSu: false });
  }

  async suexec(
    command: string | string[],
    callback?: (stdout: string) => any,
  ): Promise<ExecResult | any> {
    return this._adbExec(command, callback, { asSu: true });
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

    this.createButton(
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

    this.createButton(
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

  async reloadAdbd(): Promise<ExecResult> {
    return await fs.exec("adb", ["kill-server"]);
  }
}

const droidNet = new DroidNet();

// @ts-ignore
return baseclass.extend({
  title: droidNet.title,
  header: droidNet.header,
  selectDeviceForm: droidNet.selectDeviceForm.bind(droidNet),
  exec: droidNet.exec.bind(droidNet),
  suexec: droidNet.suexec.bind(droidNet),
  getDeviceId: droidNet.getDeviceId.bind(droidNet),
  selectDevices: droidNet.selectDevices.bind(droidNet),
  reloadAdbd: droidNet.reloadAdbd.bind(droidNet),
});
