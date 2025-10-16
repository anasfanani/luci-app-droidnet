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
  application?: AppPackage[];
  display?: number;
  [key: string]: any;
}

interface UADPackageInfo {
  list: string;
  description: string;
  dependencies: string[];
  neededBy: string[];
  labels: string[];
  removal: string;
}

interface UADData {
  [packageName: string]: UADPackageInfo;
}

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
      "/tmp/cache/uad_lists.json",
      url,
    ]);
    if (result.code !== 0) {
      throw new Error(`Download failed: ${result.stderr || "Unknown error"}`);
    }

    // Use fs.read_direct() for large files
    const uadData = await fs.read_direct("/tmp/cache/uad_lists.json", "json");
    return uadData as UADData;
  } catch (error) {
    console.error("Failed to download UAD data:", error);
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
      "/tmp/cache/uad_lists.json",
      "json",
    )) as UADData;
    return uadData;
  } catch (error) {
    // If cache doesn't exist, create single download promise
    uadDownloadPromise = (async () => {
      console.log("UAD cache not found, downloading...");
      droidnet.addNotification(
        _("UAD Database"),
        _("UAD cache not found, downloading package definitions..."),
        "info",
      );

      try {
        uadData = await downloadUADData();
        droidnet.addNotification(
          _("UAD Database"),
          _("UAD package definitions downloaded successfully."),
          "info",
        );
        return uadData;
      } catch (downloadError) {
        console.error("Failed to download UAD data:", downloadError);
        uadDownloadFailed = true; // Mark as failed to prevent retries
        droidnet.addNotification(
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
  } catch (error) {
    console.error("Failed to load UAD data:", error);
    return packages;
  }
}

function getRemovalColor(removal: string): string {
  switch (removal.toLowerCase()) {
    case "recommended":
      return "#28a745"; // Green
    case "advanced":
      return "#ffc107"; // Yellow
    case "expert":
      return "#fd7e14"; // Orange
    case "unsafe":
      return "#dc3545"; // Red
    default:
      return "#6c757d"; // Gray
  }
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

function loadServiceSettings(): any {
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
  let command = [
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
  }

  const pmResult = await droidnet.exec(command);

  const packages: AppPackage[] = [];
  const lines = (pmResult.stdout || "").trim().split("\n");

  lines.forEach((line) => {
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

function getFilteredPackages(packages: AppPackage[]): AppPackage[] {
  const filter =
    (document.getElementById("app-filter") as HTMLSelectElement)?.value ||
    "all";
  const search =
    (document.getElementById("app-search") as HTMLInputElement)?.value || "";

  let filtered = packages;

  if (search) {
    filtered = filtered.filter((pkg) =>
      pkg.name.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return filtered;
}

function applyAppFilters(packages: AppPackage[], newDisplay: number): void {
  currentPage = 1;
  const filter =
    (document.getElementById("app-filter") as HTMLSelectElement)?.value ||
    "all";

  if (filter === "all") {
    const filtered = getFilteredPackages(packages);
    updateAppTable(filtered, newDisplay);
  } else {
    // Load packages with specific filter
    getPackagesByFilter(filter).then((filteredPackages) => {
      const searchFiltered = getFilteredPackages(filteredPackages);
      updateAppTable(searchFiltered, newDisplay);
    });
  }
}

function updateAppTable(packages: AppPackage[], display: number): void {
  const container = document.querySelector(".table-container") as HTMLElement;
  const prev = document.querySelector(".prev") as HTMLButtonElement;
  const next = document.querySelector(".next") as HTMLButtonElement;

  if (container) {
    container.innerHTML = "";
    const table = renderAppTable(packages, display);
    container.appendChild(table);
  }

  const total = packages.length;
  const pages = Math.ceil(total / display);

  if (pages <= 1) {
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
  } else if (currentPage <= 1) {
    if (prev) prev.disabled = true;
    if (next) next.disabled = false;
  } else if (currentPage >= pages) {
    if (prev) prev.disabled = false;
    if (next) next.disabled = true;
  } else {
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }

  const start = (currentPage - 1) * display + 1;
  const end = Math.min(start + display - 1, total);
  const pageInfo = document.getElementById("page-info");
  if (pageInfo) {
    pageInfo.textContent = (String as any).format(
      _("Displaying %s - %s of %s"),
      start,
      end,
      total,
    );
  }
}

function renderAppTable(packages: AppPackage[], display: number): HTMLElement {
  const startIndex = (currentPage - 1) * display;
  const endIndex = Math.min(startIndex + display, packages.length);
  const currentPageData = packages.slice(startIndex, endIndex);

  const tableRows = currentPageData.map((pkg, index) => {
    const rowClass = index % 2 === 0 ? "cbi-rowstyle-1" : "cbi-rowstyle-2";
    const uadInfo = pkg.uadInfo;

    return E("tr", { class: "tr " + rowClass }, [
      E(
        "td",
        { class: "td", style: "width: 40%;" },
        [
          E("div", pkg.name),
          uadInfo
            ? E(
                "small",
                { style: "color: #666; display: block;" },
                uadInfo.description.split("\n")[0],
              )
            : null,
        ].filter(Boolean),
      ),
      E(
        "td",
        { class: "td", style: "width: 10%; text-align: center;" },
        pkg.versionCode,
      ),
      E(
        "td",
        { class: "td", style: "width: 8%; text-align: center;" },
        pkg.uid,
      ),
      E(
        "td",
        { class: "td", style: "width: 12%; text-align: center;" },
        uadInfo
          ? E(
              "span",
              {
                style: `background: ${getRemovalColor(uadInfo.removal)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;`,
              },
              uadInfo.removal,
            )
          : E("span", { style: "color: #999; font-size: 11px;" }, "Unknown"),
      ),
      E(
        "td",
        { class: "td", style: "width: 30%; text-align: center;" },
        [
          uadInfo
            ? E(
                "button",
                {
                  class: "btn cbi-button cbi-button-neutral",
                  style:
                    "font-size: 11px; padding: 2px 6px; margin-right: 5px;",
                  click: function () {
                    ui.showModal(
                      _("Package Information"),
                      [
                        E("div", { style: "margin-bottom: 10px;" }, [
                          E("strong", pkg.name),
                          E("br"),
                          E(
                            "span",
                            `Version: ${pkg.versionCode} | UID: ${pkg.uid}`,
                          ),
                          E("br"),
                          E(
                            "span",
                            {
                              style: `color: ${getRemovalColor(uadInfo.removal)};`,
                            },
                            `Removal: ${uadInfo.removal}`,
                          ),
                        ]),
                        E("div", {
                          style:
                            "border-top: 1px solid #ccc; padding-top: 10px;",
                        }),
                        E("p", uadInfo.description.replace(/\n/g, "<br>")),
                        uadInfo.dependencies.length > 0
                          ? E("div", [
                              E("strong", "Dependencies: "),
                              E("span", uadInfo.dependencies.join(", ")),
                            ])
                          : null,
                        E("div", { class: "right" }, [
                          E(
                            "button",
                            { class: "btn", click: ui.hideModal },
                            _("OK"),
                          ),
                        ]),
                      ].filter(Boolean),
                    );
                  },
                },
                _("Info"),
              )
            : null,
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-remove",
              style: "font-size: 11px; padding: 2px 6px;",
              click: async function () {
                const warning =
                  uadInfo && uadInfo.removal === "Unsafe"
                    ? _(
                        "\n⚠️ WARNING: This package is marked as UNSAFE to remove and may cause system instability!",
                      )
                    : "";

                if (
                  confirm(
                    _("Are you sure you want to uninstall %s?%s").format(
                      pkg.name,
                      warning,
                    ),
                  )
                ) {
                  try {
                    await droidnet.exec(["pm", "uninstall", pkg.name]);
                    location.reload();
                  } catch (error) {
                    alert(_("Failed to uninstall package: %s").format(error));
                  }
                }
              },
            },
            _("Uninstall"),
          ),
        ].filter(Boolean),
      ),
    ]);
  });

  return E("table", { class: "table cbi-section-table" }, [
    E("tr", { class: "tr table-titles" }, [
      E("th", { class: "th", style: "width: 40%;" }, _("Package Name")),
      E("th", { class: "th", style: "width: 10%;" }, _("Version")),
      E("th", { class: "th", style: "width: 8%;" }, _("UID")),
      E("th", { class: "th", style: "width: 12%;" }, _("UAD Status")),
      E("th", { class: "th", style: "width: 30%;" }, _("Actions")),
    ]),
    ...tableRows,
  ]);
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
  const pmResult = await droidnet.exec([
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

  lines.forEach((line) => {
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
  const packages = (data.application || []).filter((pkg: AppPackage) =>
    pkg.name.toLowerCase().includes(currentFilter.toLowerCase()),
  );

  const display = data.display || 10;
  const start = (currentPage - 1) * display;
  const end = Math.min(start + display, packages.length);
  const currentPackages = packages.slice(start, end);

  if (packages.length === 0) {
    return E("table", { class: "table cbi-section-table" }, [
      E("tr", { class: "tr table-titles" }, [
        E("th", { class: "th left" }, _("Package Name")),
        E("th", { class: "th center" }, _("Version")),
        E("th", { class: "th center" }, _("UID")),
        E("th", { class: "th center" }, _("UAD Status")),
        E("th", { class: "th" }, _("Actions")),
      ]),
      E("tr", { class: "tr cbi-rowstyle-2" }, [
        E("td", { class: "td center", colspan: "5" }, [
          E("em", _("Application not found")),
        ]),
      ]),
    ]);
  }

  const tableRows = currentPackages.map((pkg: AppPackage, index) => {
    const rowClass = index % 2 === 0 ? "cbi-rowstyle-1" : "cbi-rowstyle-2";
    const uadInfo = pkg.uadInfo;

    return E("tr", { class: "tr " + rowClass }, [
      E(
        "td",
        { class: "td left", style: "max-width: 300px;" },
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
      ),
      E("td", { class: "td center" }, pkg.versionCode),
      E("td", { class: "td center" }, pkg.uid),
      E(
        "td",
        { class: "td center" },
        uadInfo
          ? E(
              "span",
              {
                style: `background: ${getRemovalColor(uadInfo.removal)}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;`,
              },
              uadInfo.removal,
            )
          : E("span", { style: "color: #999; font-size: 11px;" }, "Unknown"),
      ),
      E(
        "td",
        { class: "td right" },
        [
          uadInfo
            ? E(
                "button",
                {
                  class: "btn cbi-button cbi-button-neutral",
                  style:
                    "font-size: 11px; padding: 2px 6px; margin-right: 5px;",
                  click: function () {
                    ui.showModal(
                      _("Package Information"),
                      [
                        E("div", { style: "margin-bottom: 10px;" }, [
                          E("strong", pkg.name),
                          E("br"),
                          E(
                            "span",
                            `Version: ${pkg.versionCode} | UID: ${pkg.uid}`,
                          ),
                          E("br"),
                          E(
                            "span",
                            {
                              style: `color: ${getRemovalColor(uadInfo.removal)};`,
                            },
                            `Removal: ${uadInfo.removal}`,
                          ),
                        ]),
                        E("div", {
                          style:
                            "border-top: 1px solid #ccc; padding-top: 10px;",
                        }),
                        E("p", {
                          innerHTML: uadInfo.description.replace(/\n/g, "<br>"),
                        }),
                        uadInfo.dependencies.length > 0
                          ? E("div", [
                              E("strong", "Dependencies: "),
                              E("span", uadInfo.dependencies.join(", ")),
                            ])
                          : null,
                        E("div", { class: "right" }, [
                          E(
                            "button",
                            { class: "btn", click: ui.hideModal },
                            _("OK"),
                          ),
                        ]),
                      ].filter(Boolean),
                    );
                  },
                },
                _("Info"),
              )
            : null,
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-neutral",
              style: "font-size: 11px; padding: 2px 6px; margin-right: 5px;",
              click: () => {
                const toggleAction = droidnet.createToggleAction(
                  `package ${pkg.name}`,
                  ["pm", "enable", "--user", "0", pkg.name],
                  ["pm", "disable", "--user", "0", pkg.name],
                  (result) =>
                    result.code === 0 &&
                    !result.stdout?.includes("Security exception"),
                );
                toggleAction.onEnable(); // Calls disable
              },
            },
            _("Disable"),
          ),
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-neutral",
              style: "font-size: 11px; padding: 2px 6px; margin-right: 5px;",
              click: () => {
                const toggleAction = droidnet.createToggleAction(
                  `package ${pkg.name}`,
                  ["pm", "unsuspend", "--user", "0", pkg.name],
                  ["pm", "suspend", "--user", "0", pkg.name],
                  (result) =>
                    result.code === 0 &&
                    !result.stdout?.includes("Security exception"),
                );
                toggleAction.onEnable(); // Calls suspend
              },
            },
            _("Suspend"),
          ),
          E(
            "button",
            {
              class: "btn cbi-button cbi-button-remove",
              style: "font-size: 11px; padding: 2px 6px;",
              click: () => {
                const warning =
                  uadInfo && uadInfo.removal === "Unsafe"
                    ? _(
                        "\n⚠️ WARNING: This package is marked as UNSAFE to remove and may cause system instability!",
                      )
                    : "";

                droidnet.confirmAction(
                  `Remove application ${pkg.name}`,
                  _("Are you sure you want to remove this application?") +
                    warning,
                  () => removeApplication(pkg.name),
                );
              },
            },
            _("Remove"),
          ),
        ].filter(Boolean),
      ),
    ]);
  });

  return E("table", { class: "table cbi-section-table" }, [
    E("tr", { class: "tr table-titles" }, [
      E("th", { class: "th left" }, _("Package Name")),
      E("th", { class: "th center" }, _("Version")),
      E("th", { class: "th center" }, _("UID")),
      E("th", { class: "th center" }, _("UAD Status")),
      E("th", { class: "th" }, _("Actions")),
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
        E(
          "span",
          { class: "control-group", style: "display: flex; gap: 10px;" },
          [
            E(
              "select",
              {
                id: "package-type-filter",
                style: "margin-right: 10px;",
                change: async function () {
                  const filter = (this as HTMLSelectElement).value;
                  saveServiceSettings();
                  currentPage = 1;

                  if (filter === "all") {
                    updateApplicationTable(data);
                  } else {
                    try {
                      const filteredPackages =
                        await getPackagesByFilter(filter);
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
              [
                E("option", { value: "all" }, _("All Packages")),
                E("option", { value: "enabled" }, _("Enabled Packages")),
                E("option", { value: "disabled" }, _("Disabled Packages")),
                E("option", { value: "system" }, _("System Packages")),
                E(
                  "option",
                  { value: "third-party" },
                  _("Third Party Packages"),
                ),
              ],
            ),
            E("input", {
              type: "text",
              class: "filter-input",
              placeholder: "Type to filter…",
              keyup: (event: KeyboardEvent) => {
                currentFilter = (event.target as HTMLInputElement).value;
                currentPage = 1;
                saveServiceSettings();
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
                  const select = document.getElementById(
                    "package-type-filter",
                  ) as HTMLSelectElement;
                  if (input) input.value = "";
                  if (select) select.value = "all";
                },
              },
              _("Clear"),
            ),
            E(
              "button",
              {
                class: "btn cbi-button cbi-button-action",
                style: "margin-left: 5px;",
                click: async () => {
                  try {
                    ui.showModal(_("Refreshing UAD Database"), [
                      E(
                        "div",
                        { style: "text-align: center; padding: 20px;" },
                        [
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
                        ],
                      ),
                    ]);

                    // Add CSS for spinner animation
                    const style = document.createElement("style");
                    style.textContent =
                      "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
                    document.head.appendChild(style);

                    uadData = null; // Clear cache
                    uadDownloadPromise = null; // Reset promise
                    uadDownloadFailed = false; // Reset failure flag
                    await downloadUADData();

                    ui.hideModal();
                    droidnet.addNotification(
                      _("UAD Database Updated"),
                      _(
                        "Package definitions have been refreshed successfully.",
                      ),
                      "info",
                    );
                    location.reload(); // Reload to show updated data
                  } catch (error) {
                    ui.hideModal();
                    droidnet.addNotification(
                      _("UAD Update Failed"),
                      _(
                        "Failed to download UAD database: %s. Please check network connectivity and permissions.",
                      ).format(String(error)),
                      "danger",
                    );
                  }
                },
              },
              _("Refresh UAD"),
            ),
          ],
        ),
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
    const page = droidnet.renderPage(sections);

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
