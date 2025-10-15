"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";

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

  closeUi(type: "OK" | "Cancel"): HTMLElement {
    if (type === "OK") {
      return E(
        "button",
        {
          class: "btn",
          click: () => window.location.reload(),
        },
        _("OK"),
      );
    } else {
      return E(
        "button",
        {
          class: "btn cbi-button cbi-button-remove",
          style: "margin-right: 10px",
          click: ui.hideModal,
        },
        _("Cancel"),
      );
    }
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

  renderTable(rows: TableRow[] = [], config: TableConfig = {}): HTMLElement {
    const defaultConfig: Required<TableConfig> = {
      col: 2,
      colSizeMap: {
        2: [50, 50],
        4: [25, 25, 25, 25],
        6: [16.6, 16.6, 16.6, 16.6],
      },
    };
    const finalConfig = { ...defaultConfig, ...config };
    const filteredRows = rows.filter(
      (item) => item !== null && item !== undefined,
    );
    const styles = ["cbi-rowstyle-1", "cbi-rowstyle-2"];
    const columnsPerRow = finalConfig.col;
    const itemsPerRow = Math.floor(columnsPerRow / 2);
    const colSizes = finalConfig.colSizeMap[columnsPerRow] || [];

    const chunkedRows: TableRow[][] = [];
    for (let i = 0; i < filteredRows.length; i += itemsPerRow) {
      chunkedRows.push(filteredRows.slice(i, i + itemsPerRow));
    }

    const tableHeader = E("tr", {
      class: "tr table-titles",
      style: "display: none;",
    });

    const tableRows = chunkedRows.map((rowGroup, rowIndex) => {
      const rowStyle = styles[rowIndex % 2];

      const cells = rowGroup.flatMap((row, idx) => {
        let actionButtons: HTMLElement[] = [];

        if (row.action) {
          actionButtons = [
            row.value
              ? E(
                  "button",
                  {
                    class: "btn cbi-button cbi-button-remove",
                    style:
                      "display: block; margin: 0 auto; padding: 2px 8px; font-size: 12px; line-height: 1.2;",
                    click: row.action.onEnable,
                  },
                  _("Disable"),
                )
              : E(
                  "button",
                  {
                    class: "btn cbi-button cbi-button-action",
                    style:
                      "display: block; margin: 0 auto; padding: 2px 8px; font-size: 12px; line-height: 1.2;",
                    click: row.action.onDisable,
                  },
                  _("Enable"),
                ),
          ];
        }

        const labelIndex = idx * 2;
        const valueIndex = labelIndex + 1;

        const getWidth = (sizes: number[], index: number): string =>
          sizes[index] !== undefined ? `${sizes[index]}%` : "auto";

        const labelTd = E(
          "td",
          {
            class: "td left",
            style: `width: ${getWidth(colSizes, labelIndex)}`,
          },
          E("b", {}, _(row.label)),
        );

        const valueTd = E(
          "td",
          {
            class: "td left",
            style: `width: ${getWidth(colSizes, valueIndex)};`,
          },
          row.action ? actionButtons : _(String(row.value)),
        );

        return [labelTd, valueTd];
      });

      return E("tr", { class: "tr " + rowStyle }, cells);
    });

    return E("table", { class: "table cbi-section-table" }, [
      tableHeader,
      ...tableRows,
    ]);
  }

  renderTitle(title: string): HTMLElement {
    return E("h3", { class: "section-title" }, _(title));
  }

  modalError(message: string, errorMessage?: string): void {
    ui.showModal(_("An error occurred"), [
      E("p", _(message)),
      errorMessage ? E("em", { style: "color: red;" }, errorMessage) : "",
      E("div", { class: "right" }, [E(this.closeUi("OK"))]),
    ]);
  }

  modalSuccess(message: string, successMessage?: string): void {
    ui.showModal(_("Success"), [
      E("p", _(message)),
      successMessage ? E("em", { style: "color: green;" }, successMessage) : "",
      E("div", { class: "right" }, [E(this.closeUi("OK"))]),
    ]);
  }

  modalLoading(message: string): void {
    ui.showModal(_("Loading..."), [E("p", { class: "spinning" }, _(message))]);
  }

  confirmAction(title: string, message: string, yesCallback: () => void): void {
    ui.showModal(_(title), [
      E("p", _(message)),
      E("div", { class: "right" }, [
        E(this.closeUi("Cancel")),
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-action",
            click: yesCallback,
          },
          _("Yes"),
        ),
      ]),
    ]);
  }

  renderTab(tabs: (TabConfig | null)[] = []): HTMLElement {
    const filteredTabs = tabs.filter(
      (item): item is TabConfig => item !== null && item !== undefined,
    );

    const tabMenu = E(
      "ul",
      { class: "cbi-tabmenu" },
      filteredTabs.map((tab, index) => {
        const tabId = `tab-${index + 1}-${tab.tabId}`;
        const isActive = index === 0;

        return E(
          "li",
          { class: isActive ? "cbi-tab" : "cbi-tab-disabled", id: tabId },
          [
            E(
              "a",
              {
                href: `#${tab.tabId}`,
                click: () => {
                  filteredTabs.forEach((_, i) => {
                    const currentTab = filteredTabs[i];
                    if (!currentTab) return;
                    const tabElement = document.getElementById(
                      `tab-${i + 1}-${currentTab.tabId}`,
                    );
                    const contentElement = document.getElementById(
                      currentTab.tabId,
                    );
                    if (tabElement)
                      tabElement.className =
                        i === index ? "cbi-tab" : "cbi-tab-disabled";
                    if (contentElement)
                      contentElement.style.display =
                        i === index ? "contents" : "none";
                  });
                },
              },
              _(tab.tabTitle),
            ),
          ],
        );
      }),
    );

    const contentSections = filteredTabs.map((tab, index) => {
      return E(
        "div",
        {
          id: tab.tabId,
          style: index === 0 ? "display: contents;" : "display: none;",
        },
        [E(tab.tabContent)],
      );
    });

    return E("div", {}, [tabMenu, ...contentSections]);
  }

  addNotification(
    title: string,
    message: string,
    type: "info" | "warning" | "danger" = "info",
  ): void {
    const icons = {
      info: "ℹ️",
      warning: "⚠️",
      danger: "❌",
    };

    const titleWithIcon = E("span", {}, [
      E(
        "span",
        { style: "margin-right: 0.5em;margin-left: 0.5em;" },
        icons[type],
      ),
      E("strong", {}, _(title)),
    ]);

    const bodyContent = E("div", { style: "margin-top: 4px;" }, [
      E("p", { style: "margin: 0; line-height: 1.4;" }, _(message)),
    ]);

    ui.addNotification(titleWithIcon, bodyContent, type);
  }

  private async __executeToggleAction(
    service: string,
    action: string,
    cmd: string[],
  ): Promise<void> {
    this.modalLoading(`${action} ${service}...`);
    const execute = await this.exec(cmd);

    if (!execute.stderr) {
      const message = `${service} has been ${action.toLowerCase()}.`;
      this.modalSuccess(message);
      this.writeLog(_(message));
    } else {
      const errorMessage = execute.stderr || "An unknown error occurred.";
      this.modalError(
        `Failed to ${action.toLowerCase()} ${service}.`,
        String(errorMessage),
      );
      this.writeLog(
        _(`Failed to ${action.toLowerCase()} ${service}: ${errorMessage}`),
      );
    }
  }

  createToggleAction(
    service: string,
    enableCmd: string[],
    disableCmd: string[],
  ): ToggleAction {
    const capitalizedService = service
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      onEnable: async () => {
        this.confirmAction(
          capitalizedService,
          `Are you sure you want to turn off ${service}?`,
          () =>
            this.__executeToggleAction(
              capitalizedService,
              "Turning off",
              disableCmd,
            ),
        );
      },
      onDisable: async () => {
        this.confirmAction(
          capitalizedService,
          `Are you sure you want to turn on ${service}?`,
          () =>
            this.__executeToggleAction(
              capitalizedService,
              "Turning on",
              enableCmd,
            ),
        );
      },
    };
  }

  renderPage(sections: (HTMLElement[] | null)[]): HTMLElement {
    return E("div", { class: "cbi-map" }, [
      E(this.header),
      ...sections
        .filter(Boolean)
        .flat()
        .map((section) => E("div", { class: "cbi-section" }, section)),
    ]);
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
