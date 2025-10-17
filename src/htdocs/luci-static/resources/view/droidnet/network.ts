/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require view";
"require ui";
"require droidnet";
"require tools/ui-renderer as UIRenderer";

interface NetworkData {
  deviceNotSet?: boolean;
  network_section?: boolean;
  [key: string]: any;
}

// Data loading functions
async function loadNetworkData(): Promise<NetworkData> {
  if (!(await droidnet.getDeviceId())) {
    return { deviceNotSet: true };
  }

  if (!(await droidnet.isDeviceConnected())) {
    return { network_section: true };
  }

  const [networkInfo, deviceInfo, apnInfo] = await Promise.all([
    loadNetworkProperties(),
    loadDeviceInfo(),
    loadApnInfo(),
  ]);

  return Object.assign(networkInfo, deviceInfo, apnInfo);
}

async function loadNetworkProperties(): Promise<Record<string, any>> {
  const properties = {
    "gsm.operator.alpha": "operator",
    "gsm.network.type": "signal",
    "gsm.version.ril-impl": "driver",
    "gsm.version.baseband": "baseband",
    "gsm.operator.isroaming": "roaming",
    "gsm.sim.operator.numeric": "mcc",
  };

  return droidnet.exec(["getprop"], (stdout: string) => {
    const networkInfo: Record<string, any> = {};
    const lines = stdout.split("\n");

    for (const line of lines) {
      for (const property in properties) {
        if (line.includes("[" + property + "]")) {
          const value = line.split("]: [")[1]?.slice(0, -1).trim() || "";
          const key = properties[property as keyof typeof properties];
          const values = value.includes(",")
            ? value.split(",").map((item) => item.trim())
            : [value];
          networkInfo[key] =
            values.length >= 2 ? values : [values[0] || "", ""];
          break;
        }
      }
    }

    Object.values(properties).forEach((key) => {
      if (!networkInfo.hasOwnProperty(key)) {
        networkInfo[key] = false;
      }
    });

    return networkInfo;
  });
}

async function loadDeviceInfo(): Promise<Record<string, any>> {
  const [imeiInfo, ipInfo, wifiInfo, dataInfo, airplaneInfo] =
    await Promise.all([
      droidnet.exec(
        ["service", "call", "iphonesubinfo", "1", "s16", "com.android.shell"],
        (stdout: string) => {
          const matches = stdout.match(/'([^']+)'/g);
          const value = matches
            ? matches
                .map((match) => match.slice(1, -1))
                .join("")
                .replace(/[.\s]/g, "")
            : "";
          return { imei_sim01: value };
        },
      ),
      droidnet.exec(["ip", "route", "get", "8.8.8.8"], (stdout: string) => {
        const parts = stdout.trim().split(/\s+/);
        const ipInfo: Record<string, string> = {};
        for (let i = 1; i < parts.length; i += 2) {
          const key = parts[i];
          const value = parts[i + 1];
          if (key && value) {
            ipInfo[key] = value;
          }
        }
        return ipInfo;
      }),
      droidnet.exec(
        ["dumpsys", "wifi", "|", "grep", "Wi-Fi is"],
        (stdout: string) => {
          return { wifi: stdout.trim() === "Wi-Fi is enabled" };
        },
      ),
      droidnet.exec(
        ["dumpsys", "telephony.registry", "|", "grep", "mDataConnectionState="],
        (stdout: string) => {
          return { data: stdout.includes("mDataConnectionState=2") };
        },
      ),
      droidnet.exec(
        ["settings", "get", "global", "airplane_mode_on"],
        (stdout: string) => {
          return { airplane: stdout.trim() === "1" };
        },
      ),
    ]);

  return Object.assign(imeiInfo, ipInfo, wifiInfo, dataInfo, airplaneInfo);
}

async function loadApnInfo(): Promise<{ apn: any }> {
  const apnInfo = await droidnet.suexec([
    "content query --uri content://telephony/carriers/preferapn",
  ]);

  if (apnInfo.stderr || !apnInfo.stdout?.trim()) {
    return { apn: {} };
  }

  const parseApnToObject = (str: string) =>
    Object.fromEntries(
      str
        .replace(/^Row: \d+\s*/, "")
        .split(", ")
        .map((pair) => {
          const [key, ...rest] = pair.split("=");
          const value = rest.length ? rest.join("=").trim() : "";
          return [key?.trim() || "", value];
        }),
    );

  return { apn: parseApnToObject(apnInfo.stdout) };
}

function parseWirelessInfo(stdout: string) {
  if (!stdout?.trim()) return {};

  const properties = {
    "mWifiInfo SSID": "ssid",
    BSSID: "bssid",
    MAC: "mac",
    RSSI: "rssi",
    "Link speed": "speed",
    Frequency: "frequency",
    "Wi-Fi standard": "type",
  };

  const wifiInfo: Record<string, string> = {};
  const firstLine = stdout.trim().split("\n")[0];
  if (!firstLine) return wifiInfo;

  firstLine.split(", ").forEach((part) => {
    const splitPart = part.split(": ");
    const key = splitPart[0]?.trim().replace(/"/g, "");
    const value = splitPart[1]?.trim().replace(/"/g, "");
    if (key && value && Object.prototype.hasOwnProperty.call(properties, key)) {
      let formattedValue = value;
      if (key === "Frequency" || key === "Link speed") {
        formattedValue = value.replace(/(\d+)([A-Za-z]+)/, "$1 $2");
      }
      if (key === "RSSI") {
        formattedValue += " dBm";
      }
      const propertyKey = properties[key as keyof typeof properties];
      wifiInfo[propertyKey] = formattedValue;
    }
  });

  return wifiInfo;
}

function renderMobileNetwork(data: NetworkData): HTMLElement[] {
  const wifiAction = UIRenderer.createToggleAction(
    "wireless",
    ["svc", "wifi", "enable"],
    ["svc", "wifi", "disable"],
    (cmd: string[]) => droidnet.exec(cmd),
    {
      onSuccess: (message, result) => {
        UIRenderer.modalSuccess(message);
        droidnet.writeLog(message);
      },
      onFailed: (error, result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.writeLog(error);
      },
      validator: (result) => result.code === 0,
    },
  );
  const dataAction = UIRenderer.createToggleAction(
    "mobile data",
    ["svc", "data", "enable"],
    ["svc", "data", "disable"],
    (cmd: string[]) => droidnet.exec(cmd),
    {
      onSuccess: (message, result) => {
        UIRenderer.modalSuccess(message);
        droidnet.writeLog(message);
      },
      onFailed: (error, result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.writeLog(error);
      },
      validator: (result) => result.code === 0,
    },
  );
  const airplaneAction = UIRenderer.createToggleAction(
    "airplane mode",
    ["cmd", "connectivity", "airplane-mode", "enable"],
    ["cmd", "connectivity", "airplane-mode", "disable"],
    (cmd: string[]) => droidnet.exec(cmd),
    {
      onSuccess: (message, result) => {
        UIRenderer.modalSuccess(message);
        droidnet.writeLog(message);
      },
      onFailed: (error, result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.writeLog(error);
      },
      validator: (result) => result.code === 0,
    },
  );

  return [
    UIRenderer.renderTitle("Mobile Network"),
    UIRenderer.renderTable([
      { label: "IP address", value: data.src || "-" },
      { label: "Gateway", value: data.via || "-" },
      { label: "Device", value: data.dev || "-" },
      { label: "Routing table", value: data.table || "-" },
      { label: "Wireless", value: data.wifi || false, action: wifiAction },
      { label: "Mobile data", value: data.data || false, action: dataAction },
      {
        label: "Airplane mode",
        value: data.airplane || false,
        action: airplaneAction,
      },
    ]),
  ];
}

async function renderWirelessInfo(
  data: NetworkData,
): Promise<HTMLElement[] | null> {
  if (!data.wifi) return null;

  const wirelessInfo = await droidnet.exec([
    'dumpsys wifi | grep "mWifiInfo SSID"',
  ]);
  if (wirelessInfo.stderr || wirelessInfo.code != 0) return null;
  if (wirelessInfo.stdout) {
    const wifiInfo = parseWirelessInfo(wirelessInfo.stdout);
    return [
      UIRenderer.renderTitle("Wireless Information"),
      UIRenderer.renderTable([
        { label: "SSID", value: wifiInfo.ssid || "-" },
        { label: "BSSID", value: wifiInfo.bssid || "-" },
        { label: "MAC address", value: wifiInfo.mac || "-" },
        { label: "RSSI", value: wifiInfo.rssi || "-" },
        { label: "Link speed", value: wifiInfo.speed || "-" },
        { label: "Frequency", value: wifiInfo.frequency || "-" },
        ...(wifiInfo.type ? [{ label: "Type", value: wifiInfo.type }] : []),
      ]),
    ];
  }
  return null;
}

function renderCellularInfo(data: NetworkData): HTMLElement[] | null {
  const createSimTab = (simIndex: number, simName: string) => {
    if (!data.operator?.[simIndex]) return null;

    return {
      tabId: `sim${simIndex + 1}`,
      tabTitle: simName,
      tabContent: UIRenderer.renderTable([
        { label: "Operator name", value: data.operator?.[simIndex] || "-" },
        { label: "Network type", value: data.signal?.[simIndex] || "-" },
        { label: "Roaming mode", value: data.roaming?.[simIndex] || "-" },
        { label: "MCC", value: data.mcc?.[simIndex] || "-" },
        { label: "IMEI", value: data.imei_sim01 || "-" },
        { label: "Driver", value: data.driver || "-" },
        { label: "Baseband", value: data.baseband || "-" },
      ]),
    };
  };

  const tabs = [createSimTab(0, "SIM 1"), createSimTab(1, "SIM 2")].filter(
    Boolean,
  );

  if (tabs.length === 0) return null;

  return [
    UIRenderer.renderTitle("Cellular Information"),
    UIRenderer.renderTab(tabs),
  ];
}

function renderApnInfo(data: NetworkData): HTMLElement[] | null {
  if (!data.apn || Object.keys(data.apn).length === 0) return null;

  const apn = data.apn;
  return [
    UIRenderer.renderTitle("APN Information"),
    UIRenderer.renderTable(
      [
        { label: "Name", value: apn.name || "-" },
        { label: "APN", value: apn.apn || "-" },
        { label: "Proxy", value: apn.proxy || "-" },
        { label: "Port", value: apn.port || "-" },
        { label: "Username", value: apn.user || "-" },
        { label: "Password", value: apn.password || "-" },
        { label: "Server", value: apn.server || "-" },
        { label: "MMSC", value: apn.mmsc || "-" },
        { label: "MMS proxy", value: apn.mmsproxy || "-" },
        { label: "MMS port", value: apn.mmsport || "-" },
        { label: "MCC", value: apn.mcc || "-" },
        { label: "MNC", value: apn.mnc || "-" },
        { label: "Authentication type", value: apn.authtype || "-" },
        { label: "APN type", value: apn.type || "-" },
        { label: "APN protocol", value: apn.protocol || "-" },
        { label: "APN roaming protocol", value: apn.roaming_protocol || "-" },
        { label: "Bearer", value: apn.bearer || "-" },
        { label: "MVNO type", value: apn.mvno_type || "-" },
        { label: "MVNO value", value: apn.mvno_match_data || "-" },
      ],
      { col: 4 },
    ),
  ];
}

// @ts-ignore
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: loadNetworkData,

  render: async function (data: NetworkData): Promise<HTMLElement> {
    if (data.deviceNotSet) {
      const devices = await droidnet.selectDevices();

      const deviceForm = await UIRenderer.createDeviceSelectionForm({
        devices: devices,
        title: "Device Selection",
        description: "Select your Android device from the list below",
        onSave: async (deviceId: string) => {
          uci.set("droidnet", "device", "id", deviceId);
          uci.save();
          window.location.reload();
        },
        onReload: async () => {
          await droidnet.reloadAdbd();
          window.location.reload();
        },
        onValidate: (deviceId: string) => {
          const isUnauthorized =
            devices.devices !== false &&
            devices.devices[deviceId] === "unauthorized";
          return isUnauthorized ? `Device ${deviceId} is unauthorized!` : true;
        },
      });

      return UIRenderer.renderPage([[deviceForm]], droidnet.header);
    }

    if (data.network_section) {
      UIRenderer.addNotification(
        "Device Not Connected",
        "Your Android device appears to be disconnected. Please check the USB connection and ensure ADB debugging is enabled.",
        "warning",
      );

      const devices = await droidnet.selectDevices();

      const deviceForm = await UIRenderer.createDeviceSelectionForm({
        devices: devices,
        title: "Device Selection",
        description: "Select your Android device from the list below",
        onSave: async (deviceId: string) => {
          uci.set("droidnet", "device", "id", deviceId);
          uci.save();
          window.location.reload();
        },
        onReload: async () => {
          await droidnet.reloadAdbd();
          window.location.reload();
        },
        onValidate: (deviceId: string) => {
          const isUnauthorized =
            devices.devices !== false &&
            devices.devices[deviceId] === "unauthorized";
          return isUnauthorized ? `Device ${deviceId} is unauthorized!` : true;
        },
      });

      return UIRenderer.renderPage([[deviceForm]], droidnet.header);
    }

    const sections = await Promise.all([
      renderMobileNetwork(data),
      renderWirelessInfo(data),
      renderCellularInfo(data),
      renderApnInfo(data),
    ]);

    return UIRenderer.renderPage(sections.filter(Boolean), droidnet.header);
  },
});
