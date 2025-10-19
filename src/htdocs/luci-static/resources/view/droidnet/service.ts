/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require view";
"require uci";
"require fs";
"require ui";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

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
  application?: AppPackage[];
  display?: number;
}

interface UADPackageInfo {
  list: string;
  description: string;
  dependencies: string[];
  neededBy: string[];
  labels: string[];
  removal: string;
}

type UADData = Record<string, UADPackageInfo>;

interface AppPackage {
  name: string;
  versionCode: string;
  uid: string;
  uadInfo?: UADPackageInfo | undefined;
}

let uadData: UADData | null = null;
let uadDownloadPromise: Promise<UADData | null> | null = null;
let uadDownloadFailed = false;

async function downloadUADData(): Promise<UADData> {
  const url =
    "https://raw.githubusercontent.com/Universal-Debloater-Alliance/universal-android-debloater-next-generation/refs/heads/main/resources/assets/uad_lists.json";

  try {
    // Ensure cache directory exists
    await fs.exec("/bin/mkdir", ["-p", "/tmp/cache"]);

    // Use wget to download
    const result = await fs.exec("/usr/bin/wget", [
      "-O",
      "/tmp/cache/droidnet_uad_lists.json",
      url,
    ]);
    if (result.code !== 0) {
      throw new Error(`Download failed: ${result.stderr || "Unknown error"}`);
    }

    // Use fs.read_direct() for large files
    const uadData = await fs.read_direct(
      "/tmp/cache/droidnet_uad_lists.json",
      "json",
    );
    return uadData as UADData;
  } catch (error) {
    throw new Error(`Download or parsing error: ${String(error)}`);
  }
}

async function loadUADData(): Promise<UADData | null> {
  if (uadData) return uadData;
  if (uadDownloadFailed) return null; // Don't retry if already failed
  if (uadDownloadPromise) return uadDownloadPromise; // Return existing promise

  try {
    // Try to load from cache first using fs.read_direct() for large files
    uadData = (await fs.read_direct(
      "/tmp/cache/droidnet_uad_lists.json",
      "json",
    )) as UADData;
    return uadData;
  } catch {
    // If cache doesn't exist, create single download promise
    uadDownloadPromise = (async () => {
      UIRenderer.addNotification(
        _("UAD Database"),
        _("UAD cache not found, downloading package definitions..."),
        "info",
      );

      try {
        uadData = await downloadUADData();
        UIRenderer.addNotification(
          _("UAD Database"),
          _("UAD package definitions downloaded successfully."),
          "info",
        );
        return uadData;
      } catch (downloadError) {
        uadDownloadFailed = true; // Mark as failed to prevent retries
        UIRenderer.addNotification(
          _("UAD Download Failed"),
          _(
            "Failed to download UAD database: %s. Package information will be limited.",
          ).format(String(downloadError)),
          "warning",
        );
        return null;
      } finally {
        uadDownloadPromise = null; // Reset promise
      }
    })();

    return uadDownloadPromise;
  }
}

async function loadUADDataForPackages(
  packages: AppPackage[],
): Promise<AppPackage[]> {
  try {
    const uadInfo = await loadUADData();
    if (!uadInfo) return packages;

    return packages.map((pkg) => ({
      ...pkg,
      uadInfo: uadInfo[pkg.name] || undefined,
    }));
  } catch {
    return packages;
  }
}

function getRemovalColor(removal: string): string {
  switch (removal.toLowerCase()) {
    case "recommended":
      return "#28a745";
    case "advanced":
      return "#ffc107";
    case "expert":
      return "#fd7e14";
    case "unsafe":
      return "#dc3545";
    default:
      return "#6c757d";
  }
}

interface ServiceSettings {
  filter: string;
  search: string;
  perPage: string;
}

function saveServiceSettings(): void {
  const settings = {
    filter:
      (document.getElementById("package-type-filter") as HTMLSelectElement)
        ?.value || "all",
    search:
      (document.querySelector(".filter-input") as HTMLInputElement)?.value ||
      "",
    perPage: "10", // Keep for future use
  };
  localStorage.setItem("droidnet-service-settings", JSON.stringify(settings));
}

function loadServiceSettings(): ServiceSettings {
  const saved = localStorage.getItem("droidnet-service-settings");
  return saved
    ? JSON.parse(saved)
    : {
        filter: "all",
        search: "",
        perPage: "10",
      };
}

async function getPackagesByFilter(filter: string): Promise<AppPackage[]> {
  const command = [
    "pm",
    "list",
    "packages",
    "-U",
    "--user",
    "0",
    "--show-versioncode",
  ];

  switch (filter) {
    case "disabled":
      command.push("-d");
      break;
    case "enabled":
      command.push("-e");
      break;
    case "system":
      command.push("-s");
      break;
    case "third-party":
      command.push("-3");
      break;
    default:
      break;
  }

  const pmResult = await DroidNet.exec(command);

  const packages: AppPackage[] = [];
  const lines = (pmResult.stdout || "").trim().split("\n");

  lines.forEach((line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("package:")) {
      const match = trimmed.match(
        /^package:(.+?)\s+versionCode:(\d+)\s+uid:(\d+)$/,
      );
      if (match) {
        packages.push({
          name: match[1] || "",
          versionCode: match[2] || "",
          uid: match[3] || "",
          uadInfo: undefined, // Will be loaded separately
        });
      }
    }
  });

  return packages;
}

let currentPage = 1;
let currentFilter = "";
const apkFile = "/tmp/upload.apk";

async function loadServiceData(): Promise<ServiceData> {
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

async function loadStorageInfo(): Promise<
  Record<
    string,
    {
      size: string;
      use: string;
      free: string;
      percentage: string;
      mounted: string;
    }
  >
> {
  const properties = {
    Size: "size",
    Used: "use",
    Avail: "free",
    "Use%": "percentage",
    Mounted: "mounted",
  };

  const result = await DroidNet.exec(["df", "sdcard", "-h"]);
  const lines = (result.stdout || "").split("\n");
  const header = lines[0]?.split(/\s+/) || [];
  const values = lines[1]?.split(/\s+/) || [];
  const storage: {
    size: string;
    use: string;
    free: string;
    percentage: string;
    mounted: string;
  } = {
    size: "",
    use: "",
    free: "",
    percentage: "",
    mounted: "",
  };

  for (let i = 0; i < header.length; i++) {
    const property = properties[header[i] as keyof typeof properties];
    if (property && values[i]) {
      storage[property as keyof typeof storage] = values[i] || "";
    }
  }

  return { storage };
}

async function loadApplicationInfo(): Promise<Record<string, AppPackage[]>> {
  const pmResult = await DroidNet.exec([
    "pm",
    "list",
    "packages",
    "-U",
    "--user",
    "0",
    "--show-versioncode",
  ]);

  const packages: AppPackage[] = [];
  const lines = (pmResult.stdout || "").trim().split("\n");

  lines.forEach((line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("package:")) {
      const match = trimmed.match(
        /^package:(.+?)\s+versionCode:(\d+)\s+uid:(\d+)$/,
      );
      if (match) {
        packages.push({
          name: match[1] || "",
          versionCode: match[2] || "",
          uid: match[3] || "",
          uadInfo: undefined, // Will be loaded separately
        });
      }
    }
  });

  return { application: packages };
}

async function executePowerAction(
  action: string,
  command: string[],
  message: string,
  delay = 10000,
): Promise<void> {
  UIRenderer.modalLoading(`${action}...`);
  await DroidNet.exec(command, { su: true });
  DroidNet.log(_(message));

  setTimeout(() => {
    UIRenderer.modalSuccess(`${action} completed`, message);
  }, delay);
}

function createPowerAction(
  title: string,
  command: string[],
  message: string,
  delay?: number,
) {
  return async () => {
    UIRenderer.confirmAction(
      title,
      `Are you sure you want to ${title.toLowerCase()}?`,
      () => executePowerAction(title, command, message, delay),
    );
  };
}

async function removeApplication(packageName: string): Promise<void> {
  UIRenderer.modalLoading(`Removing ${packageName}...`);
  const result = await DroidNet.exec(
    ["pm", "uninstall", "-k", "--user", "0", packageName],
    { su: true },
  );

  if (result.stdout?.trim() === "Success") {
    UIRenderer.modalSuccess(
      "Application removed",
      `Application ${packageName} has been successfully removed.`,
    );
    DroidNet.log(
      _("Removing %s application successfully.").format(packageName),
    );
    setTimeout(() => window.location.reload(), 2000);
  } else {
    const error = result.stderr || result.stdout || "Unknown error";
    UIRenderer.modalError(
      "Package removal failed",
      E("div", [
        E("p", _("Failed to remove %s application.").format(packageName)),
        E("em", { style: "color: red;" }, error),
      ]),
    );
    DroidNet.log(
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
    UIRenderer.renderTitle("Power Options"),
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
            UIRenderer.renderButton({
              label,
              type: "save",
              style: "margin: 10px 0!important;",
              onClick: action,
            }),
          ]),
        ),
      ),
    ]),
  ];
}

// eslint-disable-next-line max-lines-per-function
function renderApplicationTable(data: ServiceData): HTMLElement {
  const packages = (data.application || []).filter((pkg: AppPackage) =>
    pkg.name.toLowerCase().includes(currentFilter.toLowerCase()),
  );

  const display = data.display || 10;
  const start = (currentPage - 1) * display;
  const end = Math.min(start + display, packages.length);
  const currentPackages = packages.slice(start, end);

  if (packages.length === 0) {
    return UIRenderer.renderTable([[E("em", _("Application not found"))]], {
      headers: ["Package Name", "Version", "UID", "UAD Status", "Actions"],
      cellClass: "td left",
      headerClass: "th left",
    });
  }

  const rows = currentPackages.map((pkg: AppPackage) => {
    const uadInfo = pkg.uadInfo;

    const packageName = E(
      "div",
      { style: "max-width: 300px;" },
      [
        E(
          "div",
          {
            style:
              "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
          },
          pkg.name,
        ),
        uadInfo
          ? E(
              "small",
              {
                style:
                  "display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
              },
              uadInfo.description.split("\n")[0],
            )
          : null,
      ].filter(Boolean),
    );

    const uadStatus = uadInfo
      ? E(
          "span",
          {
            style: `background: ${getRemovalColor(uadInfo.removal)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;`,
          },
          uadInfo.removal,
        )
      : E("span", { style: "color: #999; font-size: 11px;" }, "Unknown");

    const infoBtn = uadInfo
      ? UIRenderer.renderButton({
          label: "Info",
          type: "neutral",
          size: "small",
          style: "margin-right: 5px;",
          onClick: () => {
            const desc = uadInfo.description
              .split("\n")
              .map((line, i, arr) =>
                i < arr.length - 1 ? [line, E("br")] : line,
              )
              .flat();

            ui.showModal(
              _("Package Information"),
              [
                E("div", { style: "margin-bottom: 10px;" }, [
                  E("strong", pkg.name),
                  E("br"),
                  E("span", `Version: ${pkg.versionCode} | UID: ${pkg.uid}`),
                  E("br"),
                  E(
                    "span",
                    { style: `color: ${getRemovalColor(uadInfo.removal)};` },
                    `Removal: ${uadInfo.removal}`,
                  ),
                ]),
                E("div", {
                  style: "border-top: 1px solid #ccc; padding-top: 10px;",
                }),
                E("p", {}, desc),
                uadInfo.dependencies.length > 0
                  ? E("div", [
                      E("strong", "Dependencies: "),
                      E("span", uadInfo.dependencies.join(", ")),
                    ])
                  : null,
                E("div", { class: "right" }, [
                  UIRenderer.renderButton({
                    label: "OK",
                    onClick: ui.hideModal,
                  }),
                ]),
              ].filter(Boolean),
            );
          },
        })
      : null;

    const disableBtn = UIRenderer.renderButton({
      label: "Disable",
      type: "neutral",
      size: "small",
      style: "margin-right: 5px;",
      onClick: () => {
        const toggleAction = UIRenderer.createToggleAction(
          `package ${pkg.name}`,
          ["pm", "enable", "--user", "0", pkg.name],
          ["pm", "disable", "--user", "0", pkg.name],
          async (cmd: string[]) => {
            const result = await DroidNet.exec(cmd, { su: true });
            return {
              code: result.code || 0,
              stdout: result.stdout || "",
              stderr: result.stderr || "",
            };
          },
          {
            onSuccess: (message) => {
              UIRenderer.modalSuccess(message);
              DroidNet.log(message);
            },
            onFailed: (error) => {
              UIRenderer.modalError("Package operation failed", error);
              DroidNet.log(error);
            },
            validator: (result) =>
              result.code === 0 &&
              !result.stdout?.includes("Security exception"),
          },
        );
        toggleAction.onEnable();
      },
    });

    const suspendBtn = UIRenderer.renderButton({
      label: "Suspend",
      type: "neutral",
      size: "small",
      style: "margin-right: 5px;",
      onClick: () => {
        const toggleAction = UIRenderer.createToggleAction(
          `package ${pkg.name}`,
          ["pm", "unsuspend", "--user", "0", pkg.name],
          ["pm", "suspend", "--user", "0", pkg.name],
          async (cmd: string[]) => {
            const result = await DroidNet.exec(cmd, { su: true });
            return {
              code: result.code || 0,
              stdout: result.stdout || "",
              stderr: result.stderr || "",
            };
          },
          {
            onSuccess: (message) => {
              UIRenderer.modalSuccess(message);
              DroidNet.log(message);
            },
            onFailed: (error) => {
              UIRenderer.modalError("Package operation failed", error);
              DroidNet.log(error);
            },
            validator: (result) =>
              result.code === 0 &&
              !result.stdout?.includes("Security exception"),
          },
        );
        toggleAction.onEnable();
      },
    });

    const removeBtn = UIRenderer.renderButton({
      label: "Remove",
      type: "remove",
      size: "small",
      onClick: () => {
        const warning =
          uadInfo && uadInfo.removal === "Unsafe"
            ? _(
                "\n⚠️ WARNING: This package is marked as UNSAFE to remove and may cause system instability!",
              )
            : "";
        UIRenderer.confirmAction(
          `Remove application ${pkg.name}`,
          _("Are you sure you want to remove this application?") + warning,
          () => removeApplication(pkg.name),
        );
      },
    });

    return [
      packageName,
      pkg.versionCode,
      pkg.uid,
      uadStatus,
      E("div", [infoBtn, disableBtn, suspendBtn, removeBtn].filter(Boolean)),
    ];
  });

  return UIRenderer.renderTable(rows, {
    headers: ["Package Name", "Version", "UID", "UAD Status", "Actions"],
    cellClass: "td left",
    headerClass: "th left",
  });
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
  const packages = (data.application || []).filter((pkg: AppPackage) =>
    pkg.name.toLowerCase().includes(currentFilter.toLowerCase()),
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

// eslint-disable-next-line max-lines-per-function
function renderApplicationManager(data: ServiceData): HTMLElement[] {
  const storage = data.storage;

  return [
    UIRenderer.renderTitle("Application Manager"),
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
        E(
          "span",
          { class: "control-group", style: "display: flex; gap: 10px;" },
          UIRenderer.renderFilters([
            {
              label: "",
              type: "select",
              id: "package-type-filter",
              style: "margin-right: 10px;",
              options: [
                { value: "all", label: "All Packages" },
                { value: "enabled", label: "Enabled Packages" },
                { value: "disabled", label: "Disabled Packages" },
                { value: "system", label: "System Packages" },
                { value: "third-party", label: "Third Party Packages" },
              ],
              onChange: async function () {
                const filter = (
                  document.getElementById(
                    "package-type-filter",
                  ) as HTMLSelectElement
                ).value;
                saveServiceSettings();
                currentPage = 1;

                if (filter === "all") {
                  updateApplicationTable(data);
                } else {
                  try {
                    const filteredPackages = await getPackagesByFilter(filter);
                    const packagesWithUAD =
                      await loadUADDataForPackages(filteredPackages);
                    const newData = { ...data, application: packagesWithUAD };
                    updateApplicationTable(newData);
                  } catch (error) {
                    console.error("Filter error:", error);
                    updateApplicationTable(data);
                  }
                }
              },
            },
            {
              label: "",
              type: "input",
              class: "filter-input",
              placeholder: "Type to filter…",
              style: "margin: 0;",
              onChange: (event?: Event) => {
                currentFilter =
                  (event?.target as HTMLInputElement)?.value || "";
                currentPage = 1;
                saveServiceSettings();
                updateApplicationTable(data);
              },
            },
            {
              label: "Clear",
              type: "button",
              class: "btn cbi-button",
              style: "margin: 0;",
              onClick: () => {
                currentFilter = "";
                currentPage = 1;
                updateApplicationTable(data);
                const input = document.querySelector(
                  ".filter-input",
                ) as HTMLInputElement;
                const select = document.getElementById(
                  "package-type-filter",
                ) as HTMLSelectElement;
                if (input) input.value = "";
                if (select) select.value = "all";
              },
            },
            {
              label: "Refresh UAD",
              type: "button",
              class: "btn cbi-button cbi-button-action",
              style: "margin: 0;",
              onClick: async () => {
                try {
                  ui.showModal(_("Refreshing UAD Database"), [
                    E("div", { style: "text-align: center; padding: 20px;" }, [
                      E(
                        "div",
                        _("Downloading latest UAD package definitions..."),
                      ),
                      E("div", { style: "margin-top: 10px;" }, [
                        E("div", {
                          class: "spinner",
                          style:
                            "display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;",
                        }),
                      ]),
                    ]),
                  ]);

                  const style = document.createElement("style");
                  style.textContent =
                    "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
                  document.head.appendChild(style);

                  uadData = null;
                  uadDownloadPromise = null;
                  uadDownloadFailed = false;
                  await downloadUADData();

                  ui.hideModal();
                  UIRenderer.addNotification(
                    _("UAD Database Updated"),
                    _("Package definitions have been refreshed successfully."),
                    "info",
                  );
                  location.reload();
                } catch (error) {
                  ui.hideModal();
                  UIRenderer.addNotification(
                    _("UAD Update Failed"),
                    _(
                      "Failed to download UAD database: %s. Please check network connectivity and permissions.",
                    ).format(String(error)),
                    "danger",
                  );
                }
              },
            },
          ]),
        ),
      ]),
      E("div", { class: "action-application", style: "padding: .25em;" }, [
        E("label", _("Actions") + " : "),
        E("span", { class: "control-group", style: "display: flex;" }, [
          UIRenderer.renderButton({
            label: "Update list",
            type: "save",
            style: "margin-right: 10px",
            onClick: () => {
              UIRenderer.modalLoading("Updating application list...");
              setTimeout(() => {
                UIRenderer.modalSuccess(
                  "Update completed",
                  "Application list has been successfully updated.",
                );
                setTimeout(() => window.location.reload(), 2000);
              }, 2000);
            },
          }),
          UIRenderer.renderButton({
            label: "Upload application",
            type: "action",
            onClick: async () => {
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

                UIRenderer.confirmAction(
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
                    UIRenderer.modalLoading("Installing application...");
                    try {
                      const deviceId = await DroidNet.getDeviceId();
                      if (!deviceId) throw new Error("Device not found");
                      const installResult = await fs.exec_direct("adb", [
                        "-s",
                        deviceId,
                        "install",
                        apkFile,
                      ]);

                      if (installResult.trim() === "Success") {
                        UIRenderer.modalSuccess(
                          "Installation completed",
                          `Application ${result.name} has been successfully installed.`,
                        );
                        DroidNet.log(
                          _(
                            "Application %s has been successfully installed.",
                          ).format(result.name),
                        );
                      } else {
                        UIRenderer.modalError(
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
                        DroidNet.log(
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
                  UIRenderer.modalError(
                    "Upload failed",
                    E("div", [
                      E("p", _("Failed to upload application.")),
                      E("em", { style: "color: red;" }, String(error)),
                    ]),
                  );
                }
              }
            },
          }),
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
        UIRenderer.renderButton({
          label: "«",
          type: "neutral",
          class: "btn cbi-button-neutral prev",
          style: "flex-basis: 20%; text-align: center;",
          disabled: true,
          onClick: () => {
            currentPage--;
            updateApplicationTable(data);
          },
        }),
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
        UIRenderer.renderButton({
          label: "»",
          type: "neutral",
          class: "btn cbi-button-neutral next",
          style: "flex-basis: 20%; text-align: center;",
          onClick: () => {
            currentPage++;
            updateApplicationTable(data);
          },
        }),
      ],
    ),
    E("div", { class: "table-container" }, renderApplicationTable(data)),
  ];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: DroidNet.load(loadServiceData),

  render: async function (data: ServiceData): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    const sections = [renderPowerOptions(), renderApplicationManager(data)];
    const page = UIRenderer.renderPage(sections);

    // Auto-restore saved settings after render
    setTimeout(async () => {
      const savedSettings = loadServiceSettings();
      const packageTypeFilter = document.getElementById(
        "package-type-filter",
      ) as HTMLSelectElement;
      const searchInput = document.querySelector(
        ".filter-input",
      ) as HTMLInputElement;

      if (packageTypeFilter) packageTypeFilter.value = savedSettings.filter;
      if (searchInput) searchInput.value = savedSettings.search;

      // Load UAD data in background (non-blocking)
      try {
        const packagesWithUAD = await loadUADDataForPackages(
          data.application || [],
        );
        data.application = packagesWithUAD;

        // Apply saved filter if not 'all'
        if (savedSettings.filter !== "all") {
          const filteredPackages = await getPackagesByFilter(
            savedSettings.filter,
          );
          const filteredWithUAD =
            await loadUADDataForPackages(filteredPackages);
          const newData = { ...data, application: filteredWithUAD };
          updateApplicationTable(newData);
        } else {
          updateApplicationTable(data);
        }
      } catch (error) {
        console.error("Failed to load UAD data:", error);
        // Continue without UAD data
        if (savedSettings.filter !== "all") {
          const filteredPackages = await getPackagesByFilter(
            savedSettings.filter,
          );
          const newData = { ...data, application: filteredPackages };
          updateApplicationTable(newData);
        }
      }
    }, 100);

    return page;
  },
});
