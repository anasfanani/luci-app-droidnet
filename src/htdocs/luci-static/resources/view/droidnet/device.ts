/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require uci";
"require view";
"require tools/ui-renderer as UIRenderer";
"require tools/droidnet as DroidNet";

interface DeviceData {
  deviceNotSet?: boolean;
  device_section?: boolean;
  [key: string]: any;
}

async function loadDeviceData(): Promise<DeviceData> {
  const [
    deviceInfo,
    uptimeInfo,
    kernelInfo,
    memoryInfo,
    batteryInfo,
    rootInfo,
  ] = await Promise.all([
    loadDeviceProperties(),
    loadUptimeInfo(),
    loadKernelInfo(),
    loadMemoryInfo(),
    loadBatteryInfo(),
    loadRootInfo(),
  ]);

  return Object.assign(
    deviceInfo,
    uptimeInfo,
    kernelInfo,
    memoryInfo,
    batteryInfo,
    rootInfo,
  );
}

async function loadDeviceProperties(): Promise<Record<string, any>> {
  const properties = {
    "ro.serialno": "device_id",
    "ro.product.brand": "device_brand",
    "ro.product.model": "device_model",
    "ro.product.device": "device_code",
    "ro.board.platform": "device_soc",
    "dalvik.vm.isa.arm.variant": "device_cpu",
    "ro.build.version.release": "device_version",
    "ro.build.version.sdk": "device_sdk",
    "ro.build.version.security_patch": "device_security",
  };

  const result = await DroidNet.exec(["getprop"]);
  const deviceInfo: Record<string, any> = {};
  const lines = (result.stdout || "").split("\n");

  for (const line of lines) {
    for (const property in properties) {
      if (line.includes("[" + property + "]")) {
        const value = line.split("]: [")[1]?.slice(0, -1).trim() || "";
        const key = properties[property as keyof typeof properties];
        deviceInfo[key] = value.includes(",")
          ? value.split(",").map((item) => item.trim())
          : value;
        break;
      }
    }
  }

  return deviceInfo;
}

async function loadUptimeInfo(): Promise<Record<string, any>> {
  const result = await DroidNet.exec(["uptime"]);
  const parts = (result.stdout || "").trim().split(/\s+/);
  const uptimeParts = parts.slice(0, 4);
  return { device_uptime: uptimeParts.join(" ").replace(/,$/, "") };
}

async function loadKernelInfo(): Promise<Record<string, any>> {
  const result = await DroidNet.exec(["uname", "-a"]);
  const parts = (result.stdout || "").trim().split(/\s+/);
  return { device_uname: { kernel: parts[2] || "", arch: parts[12] || "" } };
}

async function loadMemoryInfo(): Promise<Record<string, any>> {
  const result = await DroidNet.exec(["cat", "/proc/meminfo"]);
  const parts = (result.stdout || "").trim().split(/\s+/);
  const kbValue = parseInt(parts[1] || "0") + parseInt(parts[4] || "0");
  const gbValue = kbValue / (1024 * 1024);
  return { device_memory: gbValue.toFixed(0) + " GB" };
}

async function loadBatteryInfo(): Promise<Record<string, any>> {
  const properties = {
    level: "battery_level",
    voltage: "battery_voltage",
    technology: "battery_technology",
    temperature: "battery_temperature",
    "Charge counter": "battery_counter",
  };

  const result = await DroidNet.exec(["dumpsys", "battery"]);
  const batteryInfo: Record<string, any> = {};
  const lines = (result.stdout || "").split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    for (const property in properties) {
      if (trimmedLine.startsWith(property + ":")) {
        const parts = trimmedLine.split(":");
        let value = parts[1]?.trim() || "";

        if (property === "level") {
          value = parseInt(value) + " %";
        } else if (property === "voltage") {
          value = (parseInt(value) / 1000).toFixed(2) + " V";
        } else if (property === "temperature") {
          value = parseInt(value) / 10 + " °C";
        } else if (property === "Charge counter") {
          value = parseInt(value) / 1000 + " μAh";
        }

        const key = properties[property as keyof typeof properties];
        batteryInfo[key] = value;
      }
    }
  }

  return batteryInfo;
}

async function loadRootInfo(): Promise<Record<string, any>> {
  const result = await DroidNet.exec(["su", "-v"]);
  const trimmed = (result.stdout || "").trim();
  if (
    !trimmed ||
    trimmed === "/system/bin/sh: su: not found" ||
    trimmed === "/system/bin/sh: su: inaccessible or not found"
  ) {
    return { device_root: false };
  }

  const parts = trimmed.split(":");
  return {
    device_root: {
      version: parts[0] || "",
      name: parts[1] || "",
    },
  };
}

function renderDeviceInfo(data: DeviceData): HTMLElement[] {
  const formatValue = (
    value: string | undefined,
    transform?: (v: string) => string,
  ): string => {
    if (!value) return "-";
    return transform ? transform(value) : value;
  };

  const capitalize = (str: string): string =>
    str.charAt(0).toUpperCase() + str.slice(1);

  const formatRoot = (root: any): string => {
    if (root === false) return _("Non-root");
    if (root) return _("Root with %s (%s)").format(root.name, root.version);
    return "-";
  };

  return [
    UIRenderer.renderTitle("Device Information"),
    UIRenderer.renderTable(
      [
        { label: "Device ID", value: data["device_id"] || "-" },
        {
          label: "Processors",
          value: formatValue(data["device_cpu"], (v) => v.toUpperCase()),
        },
        { label: "Root status", value: formatRoot(data["device_root"]) },
        { label: "RAM", value: data["device_memory"] || "-" },
        {
          label: "Brand name",
          value: formatValue(data["device_brand"], capitalize),
        },
        { label: "Architecture", value: data["device_uname"]?.arch || "-" },
        { label: "Code name", value: data["device_code"] || "-" },
        { label: "Android version", value: data["device_version"] || "-" },
        {
          label: "Model number",
          value: formatValue(data["device_model"], capitalize),
        },
        { label: "SDK version", value: data["device_sdk"] || "-" },
        { label: "Used time", value: data["device_uptime"] || "-" },
        {
          label: "Security patch level",
          value: data["device_security"] || "-",
        },
        {
          label: "System on Chip (SoC)",
          value: formatValue(data["device_soc"], (v) => v.toUpperCase()),
        },
        { label: "Kernel version", value: data["device_uname"]?.kernel || "-" },
      ],
      { col: 4 },
    ),
  ];
}

function renderBatteryInfo(data: DeviceData): HTMLElement[] {
  return [
    UIRenderer.renderTitle("Battery Information"),
    UIRenderer.renderTable([
      { label: "Level", value: data["battery_level"] || "-" },
      { label: "Charge counter", value: data["battery_counter"] || "-" },
      { label: "Voltage", value: data["battery_voltage"] || "-" },
      { label: "Temperature", value: data["battery_temperature"] || "-" },
      { label: "Technology", value: data["battery_technology"] || "-" },
    ]),
  ];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: DroidNet.load(loadDeviceData),

  render: async function (data: DeviceData): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    const sections = [renderDeviceInfo(data), renderBatteryInfo(data)];

    return UIRenderer.renderPage(sections);
  },
});
