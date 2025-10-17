/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require ui";
"require form";
"require baseclass";

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

interface ToggleOptions {
  onSuccess?: (message: string, result: any) => void;
  onFailed?: (error: string, result: any) => void;
  validator?: (result: any) => boolean;
}

interface DeviceList {
  devices: Record<string, string> | false;
}

interface DeviceFormOptions {
  devices: DeviceList;
  title?: string;
  description?: string;
  onSave: (deviceId: string) => Promise<void>;
  onReload: () => Promise<void>;
  onValidate?: (deviceId: string) => boolean | string;
}

const UIRenderer = baseclass.extend({
  renderTable: function (
    rows: UITableRow[] = [],
    config: UITableConfig = {},
  ): HTMLElement {
    const defaultConfig: Required<UITableConfig> = {
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

    const chunkedRows: UITableRow[][] = [];
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
  },

  renderTitle: function (title: string): HTMLElement {
    return E("h3", { class: "section-title" }, _(title));
  },

  renderTab: function (tabs: (UITabConfig | null)[] = []): HTMLElement {
    const filteredTabs = tabs.filter(
      (item): item is UITabConfig => item !== null && item !== undefined,
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
  },

  renderPage: function (
    sections: (HTMLElement[] | null)[],
    header?: HTMLElement,
  ): HTMLElement {
    return E("div", { class: "cbi-map" }, [
      header ? E(header) : null,
      ...sections
        .filter(Boolean)
        .flat()
        .map((section) => E("div", { class: "cbi-section" }, section)),
    ]);
  },

  addNotification: function (
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
  },

  modalError: function (message: string, errorMessage?: string): void {
    ui.showModal(_("An error occurred"), [
      E("p", _(message)),
      errorMessage ? E("em", { style: "color: red;" }, errorMessage) : "",
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("OK"),
        ),
      ]),
    ]);
  },

  modalSuccess: function (message: string, successMessage?: string): void {
    ui.showModal(_("Success"), [
      E("p", _(message)),
      successMessage ? E("em", { style: "color: green;" }, successMessage) : "",
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("OK"),
        ),
      ]),
    ]);
  },

  modalLoading: function (message: string): void {
    ui.showModal(_("Loading..."), [E("p", { class: "spinning" }, _(message))]);
  },

  confirmAction: function (
    title: string,
    message: string,
    yesCallback: () => void,
  ): void {
    ui.showModal(_(title), [
      E("p", _(message)),
      E("div", { class: "right" }, [
        E(
          "button",
          {
            class: "btn cbi-button",
            click: ui.hideModal,
          },
          _("Cancel"),
        ),
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
  },

  closeUi: function (type: "OK" | "Cancel"): HTMLElement {
    if (type === "OK") {
      return E(
        "button",
        {
          class: "btn",
          click: ui.hideModal,
        },
        _("OK"),
      );
    } else {
      return E(
        "button",
        {
          class: "btn",
          click: ui.hideModal,
        },
        _("Cancel"),
      );
    }
  },

  selectDeviceForm: function (): HTMLElement {
    // This would need to be implemented with device selection logic
    // For now, return a placeholder
    return E("div", { class: "cbi-section" }, [
      E("h3", {}, _("Device Selection")),
      E("p", {}, _("Please configure your device settings.")),
    ]);
  },

  createDeviceSelectionForm: async function (
    options: DeviceFormOptions,
  ): Promise<HTMLElement> {
    const {
      devices,
      title = "Device Selection",
      description = "",
      onSave,
      onReload,
    } = options;

    let deviceSelected: string;

    // Create LuCI form (matching original implementation)
    const m = new form.Map("droidnet", title, description);
    const s = m.section(
      form.NamedSection,
      "device",
      "droidnet",
      _("Device Selection"),
    );
    (s as any).anonymous = true;

    let o: any;

    if (devices.devices === false) {
      o = s.option(form.DummyValue, "dummy", _("Device"));
      o.default = _("No device detected.");
    } else {
      o = s.option(form.ListValue, "id", _("Select Device ID"));
      Object.entries(devices.devices).forEach(
        ([deviceID, deviceModel]: [string, string]) => {
          o.value(deviceID, deviceID + " - " + deviceModel);
        },
      );

      o.validate = function (section: any, value: string): string | boolean {
        deviceSelected = value;
        const isUnauthorized: boolean =
          devices.devices !== false &&
          devices.devices[value] === "unauthorized";

        // Find and update save button (matching original timeout logic)
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
      devices.devices === false ||
      Object.values(devices.devices).every(
        (model: string) => model === "unauthorized",
      );

    // Create buttons using form system (matching original)
    this.__createFormButton(
      s,
      "save",
      _("Action"),
      _("Save Setting"),
      "positive",
      async (): Promise<void> => {
        await onSave(deviceSelected);
      },
      shouldDisable,
    );

    this.__createFormButton(
      s,
      "reload",
      _("ADB Daemon"),
      _("⟳ Reload ADB Daemon"),
      "negative",
      onReload,
    );

    return (await m.render()) as HTMLElement;
  },

  __createFormButton: function (
    section: any,
    name: string,
    title: string,
    caption: string,
    type: "positive" | "negative",
    callback: () => Promise<void>,
    disabled?: boolean,
  ): any {
    const o = section.option(form.DummyValue, name, title);
    o.inputstyle = type;
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
        value: caption,
        click: callback,
      };
      if (disabled) {
        attrs.disabled = disabled;
      }
      return E("input", attrs);
    };
    return o;
  },

  createToggleAction: function (
    service: string,
    enableCmd: string[],
    disableCmd: string[],
    execFunction: (cmd: string[]) => Promise<any>,
    options?: ToggleOptions,
  ): UIToggleAction {
    const capitalizedService = service
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const executeToggleAction = async (
      action: string,
      cmd: string[],
    ): Promise<void> => {
      this.modalLoading(`${action} ${service}...`);
      const execute = await execFunction(cmd);

      const isSuccess = options?.validator
        ? options.validator(execute)
        : execute.code === 0 && !execute.stderr;

      if (isSuccess) {
        const message = `${service} has been ${action.toLowerCase()}.`;

        if (options?.onSuccess) {
          options.onSuccess(message, execute);
        } else {
          this.modalSuccess(message);
        }
      } else {
        const errorMessage =
          execute.stderr || execute.stdout || "An unknown error occurred.";
        const specificError = String(errorMessage).includes(
          "Security exception",
        )
          ? `Permission denied: Cannot ${action.toLowerCase()} ${service} (system restriction)`
          : `Failed to ${action.toLowerCase()} ${service}: ${errorMessage}`;

        if (options?.onFailed) {
          options.onFailed(specificError, execute);
        } else {
          this.modalError(
            `Failed to ${action.toLowerCase()} ${service}.`,
            specificError,
          );
        }
      }
    };

    return {
      onEnable: async () => {
        this.confirmAction(
          capitalizedService,
          `Are you sure you want to turn off ${service}?`,
          () => executeToggleAction("Turning off", disableCmd),
        );
      },
      onDisable: async () => {
        this.confirmAction(
          capitalizedService,
          `Are you sure you want to turn on ${service}?`,
          () => executeToggleAction("Turning on", enableCmd),
        );
      },
    };
  },
});

// @ts-ignore
return UIRenderer;
