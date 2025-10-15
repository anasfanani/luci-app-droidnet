/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require view";
"require uci";
"require fs";
"require ui";
"require droidnet";

interface ServiceData {
  deviceNotSet?: boolean;
  service_section?: boolean;
  storage?: {
    size: string;
    use: string;
    free: string;
    percentage: string;
    mounted: string;
  };
  application?: string[];
  display?: number;
  [key: string]: any;
}

let currentPage = 1;
let currentFilter = "";
const apkFile = "/tmp/upload.apk";

async function loadServiceData(): Promise<ServiceData> {
  if (!(await droidnet.getDeviceId())) {
    return { deviceNotSet: true };
  }

  if (!(await droidnet.isDeviceConnected())) {
    return { service_section: true };
  }

  await uci.load("droidnet");
  const display = uci.get("droidnet", "device", "display_app") || 10;

  const [storageInfo, applicationInfo] = await Promise.all([
    loadStorageInfo(),
    loadApplicationInfo(),
  ]);

  return Object.assign(
    { display: parseInt(String(display)) },
    storageInfo,
    applicationInfo,
  );
}

async function loadStorageInfo(): Promise<Record<string, any>> {
  const properties = {
    Size: "size",
    Used: "use",
    Avail: "free",
    "Use%": "percentage",
    Mounted: "mounted",
  };

  return droidnet.exec(["df", "sdcard", "-h"], (stdout: string) => {
    const lines = stdout.split("\n");
    const header = lines[0]?.split(/\s+/) || [];
    const values = lines[1]?.split(/\s+/) || [];
    const storage: Record<string, string> = {};

    for (let i = 0; i < header.length; i++) {
      const property = properties[header[i] as keyof typeof properties];
      if (property && values[i]) {
        storage[property] = values[i] || "";
      }
    }

    return { storage };
  });
}

async function loadApplicationInfo(): Promise<Record<string, any>> {
  return droidnet.exec(["pm", "list", "packages"], (stdout: string) => {
    const packages = stdout
      .trim()
      .split("\n")
      .map((line) => line.replace("package:", ""))
      .filter(Boolean);
    return { application: packages };
  });
}

async function executePowerAction(
  action: string,
  command: string[],
  message: string,
  delay: number = 10000,
): Promise<void> {
  droidnet.modalLoading(`${action}...`);
  await droidnet.exec(command);
  droidnet.writeLog(_(message));

  setTimeout(() => {
    droidnet.modalSuccess(`${action} completed`, message);
  }, delay);
}

function createPowerAction(
  title: string,
  command: string[],
  message: string,
  delay?: number,
) {
  return async () => {
    droidnet.confirmAction(
      title,
      `Are you sure you want to ${title.toLowerCase()}?`,
      () => executePowerAction(title, command, message, delay),
    );
  };
}

async function removeApplication(packageName: string): Promise<void> {
  droidnet.modalLoading(`Removing ${packageName}...`);
  const result = await droidnet.exec([
    "pm",
    "uninstall",
    "-k",
    "--user",
    "0",
    packageName,
  ]);

  if (result.stdout?.trim() === "Success") {
    droidnet.modalSuccess(
      "Application removed",
      `Application ${packageName} has been successfully removed.`,
    );
    droidnet.writeLog(
      _("Removing %s application successfully.").format(packageName),
    );
    setTimeout(() => window.location.reload(), 2000);
  } else {
    const error = result.stderr || result.stdout || "Unknown error";
    droidnet.modalError(
      "Package removal failed",
      E("div", [
        E("p", _("Failed to remove %s application.").format(packageName)),
        E("em", { style: "color: red;" }, error),
      ]),
    );
    droidnet.writeLog(
      _("Failed to remove %s application: %s").format(packageName, error),
    );
  }
}

function renderPowerOptions(): HTMLElement[] {
  const powerActions = [
    {
      label: "Fastboot mode",
      action: createPowerAction(
        "Fastboot mode",
        ["reboot", "bootloader"],
        "Device entered fastboot mode.",
      ),
    },
    {
      label: "Recovery mode",
      action: createPowerAction(
        "Recovery mode",
        ["reboot", "recovery"],
        "Device entered recovery mode.",
      ),
    },
    {
      label: "Restart",
      action: createPowerAction(
        "Restart device",
        ["reboot"],
        "Device restarted successfully.",
        30000,
      ),
    },
    {
      label: "Shutdown",
      action: createPowerAction(
        "Shutdown device",
        ["reboot", "-p"],
        "Device powered off successfully.",
        15000,
      ),
    },
  ];

  return [
    droidnet.renderTitle("Power Options"),
    E(
      "div",
      { class: "cbi-section-descr" },
      _(
        "Let you shutdown, restart, access fastboot mode or recovery mode, all in one place.",
      ),
    ),
    E("table", { class: "table cbi-section-table" }, [
      E(
        "tr",
        { class: "tr", style: "border: none;" },
        powerActions.map(({ label, action }) =>
          E("td", { class: "td center", style: "border: none;" }, [
            E(
              "button",
              {
                class: "btn cbi-button cbi-button-save",
                style: "margin: 10px 0!important;",
                click: action,
              },
              _(label),
            ),
          ]),
        ),
      ),
    ]),
  ];
}

function renderApplicationTable(data: ServiceData): HTMLElement {
  const packages = (data.application || []).filter((pkg) =>
    pkg.toLowerCase().includes(currentFilter.toLowerCase()),
  );

  const display = data.display || 10;
  const start = (currentPage - 1) * display;
  const end = Math.min(start + display, packages.length);
  const currentPackages = packages.slice(start, end);

  if (packages.length === 0) {
    return E("table", { class: "table cbi-section-table" }, [
      E("tr", { class: "tr table-titles" }, [
        E("th", { class: "th left" }, _("Application name")),
        E("th", { class: "th" }),
      ]),
      E("tr", { class: "tr cbi-rowstyle-2" }, [
        E("td", { class: "td center", colspan: "2" }, [
          E("em", _("Application not found")),
        ]),
      ]),
    ]);
  }

  const tableRows = currentPackages.map((pkg, index) => {
    const rowClass = index % 2 === 0 ? "cbi-rowstyle-1" : "cbi-rowstyle-2";
    return E("tr", { class: "tr " + rowClass }, [
      E("td", { class: "td left" }, pkg),
      E("td", { class: "td right" }, [
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-remove",
            click: () => {
              droidnet.confirmAction(
                `Remove application ${pkg}`,
                "Are you sure you want to remove this application?",
                () => removeApplication(pkg),
              );
            },
          },
          _("Remove"),
        ),
      ]),
    ]);
  });

  return E("table", { class: "table cbi-section-table" }, [
    E("tr", { class: "tr table-titles" }, [
      E("th", { class: "th left" }, _("Application name")),
      E("th", { class: "th" }),
    ]),
    ...tableRows,
  ]);
}

function updateApplicationTable(data: ServiceData): void {
  const container = document.querySelector(".table-container");
  if (container) {
    container.innerHTML = "";
    container.appendChild(renderApplicationTable(data));
  }
  updatePagination(data);
}

function updatePagination(data: ServiceData): void {
  const packages = (data.application || []).filter((pkg) =>
    pkg.toLowerCase().includes(currentFilter.toLowerCase()),
  );
  const display = data.display || 10;
  const total = packages.length;
  const pages = Math.ceil(total / display);

  const prevBtn = document.querySelector(".prev") as HTMLButtonElement;
  const nextBtn = document.querySelector(".next") as HTMLButtonElement;
  const pageInfo = document.getElementById("page-info");

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= pages;

  const start = (currentPage - 1) * display + 1;
  const end = Math.min(start + display - 1, total);
  if (pageInfo) {
    pageInfo.textContent = _("Displaying %s - %s of %s").format(
      start,
      end,
      total,
    );
  }
}

function renderApplicationManager(data: ServiceData): HTMLElement[] {
  const storage = data.storage;

  return [
    droidnet.renderTitle("Application Manager"),
    E(
      "div",
      { class: "cbi-section-descr" },
      _("Lists installed apps on device."),
    ),
    E("div", { class: "controls", style: "display: flex; flex-wrap: wrap;" }, [
      E(
        "div",
        {
          class: "disk-application",
          style: "flex-basis: 100%; min-width: 250px; padding: .25em;",
        },
        [
          E("label", _("Disk space") + " : "),
          E(
            "div",
            {
              class: "cbi-progressbar",
              title: _("%s used (%s used of %s, %s free)").format(
                storage?.percentage || "0%",
                storage?.use || "0",
                storage?.size || "0",
                storage?.free || "0",
              ),
            },
            [
              E(
                "div",
                { style: `width: ${storage?.percentage || "0%"};` },
                "&nbsp;",
              ),
            ],
          ),
        ],
      ),
      E("div", { class: "filter-application", style: "padding: .25em;" }, [
        E("label", _("Filter") + " : "),
        E("span", { class: "control-group", style: "display: flex;" }, [
          E("input", {
            type: "text",
            class: "filter-input",
            placeholder: "Type to filter…",
            keyup: (event: KeyboardEvent) => {
              currentFilter = (event.target as HTMLInputElement).value;
              currentPage = 1;
              updateApplicationTable(data);
            },
          }),
          E(
            "button",
            {
              class: "btn cbi-button",
              click: () => {
                currentFilter = "";
                currentPage = 1;
                updateApplicationTable(data);
                const input = document.querySelector(
                  ".filter-input",
                ) as HTMLInputElement;
                if (input) input.value = "";
              },
            },
            _("Clear"),
          ),
        ]),
      ]),
      E("div", { class: "action-application", style: "padding: .25em;" }, [
        E("label", _("Actions") + " : "),
        E("span", { class: "control-group", style: "display: flex;" }, [
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-save",
              style: "margin-right: 10px",
              click: () => {
                droidnet.modalLoading("Updating application list...");
                setTimeout(() => {
                  droidnet.modalSuccess(
                    "Update completed",
                    "Application list has been successfully updated.",
                  );
                  setTimeout(() => window.location.reload(), 2000);
                }, 2000);
              },
            },
            _("Update list"),
          ),
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-action",
              click: async () => {
                try {
                  const result = await ui.uploadFile(apkFile);

                  const fileInfo = [
                    result.size
                      ? E(
                          "li",
                          `${_("Size")}: ${(result.size / 1024 / 1024).toFixed(2)}MB`,
                        )
                      : "",
                    result.checksum
                      ? E("li", `${_("MD5")}: ${result.checksum}`)
                      : "",
                    result.sha256sum
                      ? E("li", `${_("SHA256")}: ${result.sha256sum}`)
                      : "",
                  ].filter(Boolean);

                  droidnet.confirmAction(
                    "Install application",
                    E("div", [
                      E(
                        "p",
                        _(
                          "Installing application from untrusted sources is a potential security risk, really attempt to install %s?",
                        ).format(result.name),
                      ),
                      fileInfo.length > 0 ? E("ul", fileInfo) : "",
                    ]),
                    async () => {
                      droidnet.modalLoading("Installing application...");
                      try {
                        const deviceId = await droidnet.getDeviceId();
                        if (!deviceId) throw new Error("Device not found");
                        const installResult = await fs.exec_direct("adb", [
                          "-s",
                          deviceId,
                          "install",
                          apkFile,
                        ]);

                        if (installResult.trim() === "Success") {
                          droidnet.modalSuccess(
                            "Installation completed",
                            `Application ${result.name} has been successfully installed.`,
                          );
                          droidnet.writeLog(
                            _(
                              "Application %s has been successfully installed.",
                            ).format(result.name),
                          );
                        } else {
                          droidnet.modalError(
                            "Installation failed",
                            E("div", [
                              E(
                                "p",
                                _("Failed to install %s application.").format(
                                  result.name,
                                ),
                              ),
                              E("em", { style: "color: red;" }, installResult),
                            ]),
                          );
                          droidnet.writeLog(
                            _("Failed to install %s application: %s").format(
                              result.name,
                              installResult,
                            ),
                          );
                        }
                      } finally {
                        await fs.remove(apkFile);
                      }
                    },
                  );
                } catch (error) {
                  if (String(error) !== "Upload has been cancelled") {
                    droidnet.modalError(
                      "Upload failed",
                      E("div", [
                        E("p", _("Failed to upload application.")),
                        E("em", { style: "color: red;" }, String(error)),
                      ]),
                    );
                  }
                }
              },
            },
            _("Upload application"),
          ),
        ]),
      ]),
    ]),
    E(
      "div",
      {
        class: "controls",
        style:
          "display: flex; flex-wrap: wrap; justify-content: space-around; padding: 1em 0;",
      },
      [
        E(
          "button",
          {
            class: "btn cbi-button-neutral prev",
            style: "flex-basis: 20%; text-align: center;",
            disabled: true,
            click: () => {
              currentPage--;
              updateApplicationTable(data);
            },
          },
          "«",
        ),
        E(
          "div",
          {
            class: "text",
            id: "page-info",
            style: "flex-grow: 1; align-self: center; text-align: center;",
          },
          _("Displaying 1 - %s of %s").format(
            data.display || 10,
            (data.application || []).length,
          ),
        ),
        E(
          "button",
          {
            class: "btn cbi-button-neutral next",
            style: "flex-basis: 20%; text-align: center;",
            click: () => {
              currentPage++;
              updateApplicationTable(data);
            },
          },
          "»",
        ),
      ],
    ),
    E("div", { class: "table-container" }, renderApplicationTable(data)),
  ];
}

// @ts-ignore
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: loadServiceData,

  render: function (data: ServiceData): HTMLElement {
    if (data.deviceNotSet) {
      return droidnet.selectDeviceForm();
    }

    if (data.service_section) {
      droidnet.addNotification(
        "Error: Device conflict!",
        "Please check your settings, the configured device and ADB devices are conflicting.",
        "danger",
      );

      return droidnet.selectDeviceForm();
    }

    const sections = [renderPowerOptions(), renderApplicationManager(data)];

    return droidnet.renderPage(sections);
  },
});
