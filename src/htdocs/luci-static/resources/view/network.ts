/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require view";
"require uci";
"require fs";
"require ui";
"require form";
"require droidnet";

declare const droidnet: ReturnType<() => DroidNet>;

interface NetworkData {
  deviceNotSet?: boolean;
  network_section?: boolean;
  operator?: string[];
  signal?: string[];
  roaming?: string[];
  mcc?: string[];
  imei_sim01?: string;
  driver?: string;
  baseband?: string;
  src?: string;
  via?: string;
  dev?: string;
  table?: string;
  wifi?: boolean;
  data?: boolean;
  airplane?: boolean;
  apn?: ApnInfo;
}

interface ApnInfo {
  name?: string;
  apn?: string;
  proxy?: string;
  port?: string;
  user?: string;
  password?: string;
  server?: string;
  mmsc?: string;
  mmsproxy?: string;
  mmsport?: string;
  mcc?: string;
  mnc?: string;
  authtype?: string;
  type?: string;
  protocol?: string;
  roaming_protocol?: string;
  bearer?: string;
  mvno_type?: string;
  mvno_match_data?: string;
}

interface WifiInfo {
  ssid?: string;
  bssid?: string;
  mac?: string;
  rssi?: string;
  speed?: string;
  frequency?: string;
  type?: string;
}

function parseWirelessInfo(stdout: string): WifiInfo {
  const properties: Record<string, keyof WifiInfo> = {
    "mWifiInfo SSID": "ssid",
    BSSID: "bssid",
    MAC: "mac",
    RSSI: "rssi",
    "Link speed": "speed",
    Frequency: "frequency",
    "Wi-Fi standard": "type",
  };

  const wifiInfo: WifiInfo = {};
  const firstLine = stdout.trim().split("\n")[0];
  if (!firstLine) return wifiInfo;

  const lines = firstLine.split(", ");

  lines.forEach((part) => {
    const splitPart = part.split(": ");
    const key = splitPart[0]?.trim().replace(/"/g, "");
    const value = splitPart[1]?.trim().replace(/"/g, "");

    if (key && value && properties[key]) {
      let formattedValue = value;
      if (key === "Frequency" || key === "Link speed") {
        formattedValue = value.replace(/(\d+)([A-Za-z]+)/, "$1 $2");
      }
      if (key === "RSSI") {
        formattedValue += " dBm";
      }
      const propertyKey = properties[key];
      if (propertyKey) {
        wifiInfo[propertyKey] = formattedValue;
      }
    }
  });

  return wifiInfo;
}
// @ts-ignore
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: async function (): Promise<NetworkData> {
    if (!(await droidnet.getDeviceId())) return { deviceNotSet: true };

    const networkProperties: Record<string, keyof NetworkData> = {
      "gsm.operator.alpha": "operator",
      "gsm.network.type": "signal",
      "gsm.version.ril-impl": "driver",
      "gsm.version.baseband": "baseband",
      "gsm.operator.isroaming": "roaming",
      "gsm.sim.operator.numeric": "mcc",
    };

    const networkInfoPromise = droidnet.exec(["getprop"], (stdout: string) => {
      const networkInfo: Partial<NetworkData> = {};
      const lines = stdout.split("\n");
      for (const line of lines) {
        for (const property in networkProperties) {
          if (line.includes("[" + property + "]")) {
            const value = line.split("]: [")[1].slice(0, -1).trim();
            const key = networkProperties[property];
            (networkInfo as any)[key] = value.includes(",")
              ? value.split(",").map((item) => item.trim())
              : [value, ""];
            break;
          }
        }
      }
      for (const property in networkProperties) {
        const key = networkProperties[property];
        if (!networkInfo.hasOwnProperty(key)) {
          (networkInfo as any)[key] = false;
        }
      }
      return networkInfo;
    });

    const imeiInfoPromise = droidnet.exec(
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
    );

    const ipInfoPromise = droidnet.exec(
      ["ip", "route", "get", "8.8.8.8"],
      (stdout: string) => {
        const parts = stdout.trim().split(/\s+/);
        const ipInfo: Record<string, string> = {};
        for (let i = 1; i < parts.length; i += 2) {
          ipInfo[parts[i]] = parts[i + 1];
        }
        return ipInfo;
      },
    );

    const wifiInfoPromise = droidnet.exec(
      ["dumpsys", "wifi", "|", "grep", "Wi-Fi is"],
      (stdout: string) => {
        return { wifi: stdout.trim() === "Wi-Fi is enabled" };
      },
    );

    const dataInfoPromise = droidnet.exec(
      ["dumpsys", "telephony.registry", "|", "grep", "mDataConnectionState="],
      (stdout: string) => {
        return { data: stdout.includes("mDataConnectionState=2") };
      },
    );

    const airplaneInfoPromise = droidnet.exec(
      ["settings", "get", "global", "airplane_mode_on"],
      (stdout: string) => {
        return { airplane: stdout.trim() === "1" };
      },
    );

    const apnInfo = await droidnet.suexec([
      "content query --uri content://telephony/carriers/preferapn",
    ]);
    const parseApnToObject = (str: string): ApnInfo =>
      Object.fromEntries(
        str
          .replace(/^Row: \d+\s*/, "")
          .split(", ")
          .map((pair) => {
            const [key, ...rest] = pair.split("=");
            const value = rest.length ? rest.join("=").trim() : "";
            return [key.trim(), value];
          }),
      ) as ApnInfo;

    let apnObject: { apn: ApnInfo | null } = { apn: null };
    if (!apnInfo.error) {
      apnObject = { apn: parseApnToObject(apnInfo.stdout) };
    }

    const results = await Promise.all([
      networkInfoPromise,
      imeiInfoPromise,
      ipInfoPromise,
      wifiInfoPromise,
      dataInfoPromise,
      airplaneInfoPromise,
    ]);

    const [networkInfo, imeiInfo, ipInfo, wifiInfo, dataInfo, airplaneInfo] =
      results;

    if (
      networkInfo &&
      imeiInfo &&
      ipInfo &&
      wifiInfo &&
      dataInfo &&
      airplaneInfo
    ) {
      return Object.assign(
        networkInfo,
        imeiInfo,
        ipInfo,
        wifiInfo,
        dataInfo,
        airplaneInfo,
        apnObject,
      );
    } else {
      throw new Error(_("Failed to get complete device information."));
    }
  },

  render: async function (data: NetworkData): Promise<HTMLElement> {
    if (data.deviceNotSet) {
      return droidnet.selectDeviceForm();
    }

    if (data.network_section) {
      ui.addNotification(
        _("Error: Device conflict!"),
        E(
          "p",
          _(
            "Please check your settings, the configured device and ADB devices are conflicting.",
          ),
        ),
        "danger",
      );

      return E("div", { class: "cbi-map" }, [
        E(droidnet.header),
        E("div", { class: "cbi-section" }, [
          E(
            "div",
            {
              class: "cbi-value",
              style: "text-align: center; display: block;",
            },
            [E("em", _("No device detected or connected."))],
          ),
        ]),
      ]);
    }

    const networkMenu = [
      droidnet.renderTitle("Mobile Network"),
      droidnet.renderTable([
        { label: "IP address", value: data.src || "-" },
        { label: "Gateway", value: data.via || "-" },
        { label: "Device", value: data.dev || "-" },
        { label: "Routing table", value: data.table || "-" },
        {
          label: "Wireless",
          value: data.wifi || false,
          action: {
            onDisable: async () => {
              droidnet.confirmAction(
                "Wireless network",
                "Are you sure you want to switch on the wireless connection?",
                async () => {
                  droidnet.modalLoading(
                    "Waiting for the wireless connection to be turned on…",
                  );
                  const execute = await droidnet.exec(["svc wifi enable"]);

                  if (!execute.error) {
                    const message =
                      "Wireless connection has been successfully switched on.";
                    droidnet.modalSuccess(message);
                    droidnet.writeLog(_(message));
                  } else {
                    const errorMessage =
                      execute.error || "An unknown error occurred.";
                    droidnet.modalError(
                      "Failed to switch on the wireless connection.",
                      String(errorMessage),
                    );
                    droidnet.writeLog(
                      _(
                        "Failed to switch on wireless connection: " +
                          errorMessage,
                      ),
                    );
                  }
                },
              );
            },
            onEnable: async () => {
              droidnet.confirmAction(
                "Wireless network",
                "Are you sure you want to switch off the wireless connection?",
                async () => {
                  droidnet.modalLoading(
                    "Waiting for the wireless connection to be turned off…",
                  );
                  const execute = await droidnet.exec(["svc wifi disable"]);
                  if (!execute.error) {
                    const message =
                      "The wireless connection has been successfully turned off.";
                    droidnet.modalSuccess(message);
                    droidnet.writeLog(_(message));
                  } else {
                    const errorMessage =
                      execute.error || "An unknown error occurred.";
                    droidnet.modalError(
                      "Failed to turn off the wireless connection.",
                      String(errorMessage),
                    );
                    droidnet.writeLog(
                      _(
                        "Failed to switch off wireless connection: " +
                          errorMessage,
                      ),
                    );
                  }
                },
              );
            },
          },
        },
        {
          label: "Mobile data",
          value: data.data || false,
          action: {
            onDisable: async () => {
              droidnet.confirmAction(
                "Mobile network",
                "Are you sure you want to switch on mobile data?",
                async () => {
                  if (data.airplane === true) {
                    const errorMessage =
                      "Failed to switch on mobile data because airplane mode is active.";
                    droidnet.modalError(errorMessage);
                    droidnet.writeLog(_(errorMessage));
                  } else {
                    droidnet.modalLoading(
                      "Waiting for mobile data to be turned on…",
                    );
                    const execute = await droidnet.exec(["svc data enable"]);
                    if (!execute.error) {
                      const message =
                        "Mobile data has been successfully switched on.";
                      droidnet.modalSuccess(message);
                      droidnet.writeLog(_(message));
                    } else {
                      const errorMessage =
                        execute.error || "An unknown error occurred.";
                      droidnet.modalError(
                        "Failed to switch on mobile data.",
                        String(errorMessage),
                      );
                      droidnet.writeLog(
                        _("Failed to switch on mobile data: " + errorMessage),
                      );
                    }
                  }
                },
              );
            },
            onEnable: async () => {
              droidnet.confirmAction(
                "Mobile network",
                "Are you sure you want to switch off mobile data?",
                async () => {
                  droidnet.modalLoading(
                    "Waiting for mobile data to be turned off…",
                  );
                  const execute = await droidnet.exec(["svc data disable"]);
                  if (!execute.error) {
                    const message =
                      "Mobile data has been successfully switched off.";
                    droidnet.modalSuccess(message);
                    droidnet.writeLog(_(message));
                  } else {
                    const errorMessage =
                      execute.error || _("An unknown error occurred.");
                    droidnet.modalError(
                      "Failed to switch off mobile data.",
                      String(errorMessage),
                    );
                    droidnet.writeLog(
                      _("Failed to switch off mobile data: " + errorMessage),
                    );
                  }
                },
              );
            },
          },
        },
        {
          label: "Airplane mode",
          value: data.airplane || false,
          action: {
            onDisable: async () => {
              droidnet.confirmAction(
                "Airplane mode",
                "Are you sure want to switched on airplane mode?",
                async () => {
                  droidnet.modalLoading(
                    "Waiting for the airplane mode to be turned on…",
                  );
                  const execute = await droidnet.exec([
                    "cmd connectivity airplane-mode enable",
                  ]);

                  if (!execute.error) {
                    const message =
                      "Airplane mode has been successfully switched on.";
                    droidnet.modalSuccess(message);
                    droidnet.writeLog(_(message));
                  } else {
                    const errorMessage =
                      execute.error || "An unknown error occurred.";
                    droidnet.modalError(
                      "Failed to switch on the airplane mode.",
                      String(errorMessage),
                    );
                    droidnet.writeLog(
                      _("Failed to switch on airplane mode: " + errorMessage),
                    );
                  }
                },
              );
            },
            onEnable: async () => {
              droidnet.confirmAction(
                "Airplane mode",
                "Are you sure want to switched off airplane mode?",
                async () => {
                  droidnet.modalLoading(
                    "Waiting for the airplane mode to be turned off…",
                  );
                  const execute = await droidnet.exec([
                    "cmd connectivity airplane-mode disable",
                  ]);
                  if (!execute.error) {
                    const message =
                      "The airplane mode has been successfully turned off.";
                    droidnet.modalSuccess(message);
                    droidnet.writeLog(_(message));
                  } else {
                    const errorMessage =
                      execute.error || "An unknown error occurred.";
                    droidnet.modalError(
                      "Failed to turn off the airplane mode.",
                      String(errorMessage),
                    );
                    droidnet.writeLog(
                      _("Failed to switch off airplane mode: " + errorMessage),
                    );
                  }
                },
              );
            },
          },
        },
      ]),
    ];

    const getWirelessInfo = await droidnet.exec([
      'dumpsys wifi | grep "mWifiInfo SSID"',
    ]);
    let wifiInfo: WifiInfo = {};
    if (!getWirelessInfo.error) {
      wifiInfo = parseWirelessInfo(getWirelessInfo.stdout);
    }

    const wirelesMenu =
      data.wifi === true
        ? [
            droidnet.renderTitle("Wireless Information"),
            droidnet.renderTable([
              { label: "SSID", value: wifiInfo.ssid || "-" },
              { label: "BSSID", value: wifiInfo.bssid || "-" },
              { label: "MAC address", value: wifiInfo.mac || "-" },
              { label: "RSSI", value: wifiInfo.rssi || "-" },
              { label: "Link speed", value: wifiInfo.speed || "-" },
              { label: "Frequency", value: wifiInfo.frequency || "-" },
              ...(wifiInfo.type
                ? [{ label: "Type", value: wifiInfo.type }]
                : []),
            ]),
          ]
        : [];

    const cellularMenu = [
      droidnet.renderTitle("Cellular Information"),
      droidnet.renderTab([
        (data.operator &&
          data.operator[0] && {
            tabId: "sim1",
            tabTitle: "SIM 1",
            tabContent: droidnet.renderTable([
              { label: "Operator name", value: data.operator[0] || "-" },
              { label: "Network type", value: data.signal?.[0] || "-" },
              { label: "Roaming mode", value: data.roaming?.[0] || "-" },
              { label: "MCC", value: data.mcc?.[0] || "-" },
              { label: "IMEI", value: data.imei_sim01 || "-" },
              { label: "Driver", value: data.driver || "-" },
              { label: "Baseband", value: data.baseband || "-" },
            ]),
          }) ||
          null,
        (data.operator &&
          data.operator[1] && {
            tabId: "sim2",
            tabTitle: "SIM 2",
            tabContent: droidnet.renderTable([
              { label: "Operator name", value: data.operator[1] || "-" },
              { label: "Network type", value: data.signal?.[1] || "-" },
              { label: "Roaming mode", value: data.roaming?.[1] || "-" },
              { label: "MCC", value: data.mcc?.[1] || "-" },
              { label: "IMEI", value: data.imei_sim01 || "-" },
              { label: "Driver", value: data.driver || "-" },
              { label: "Baseband", value: data.baseband || "-" },
            ]),
          }) ||
          null,
      ]),
    ];

    const apn = data.apn;
    const apnMenu = apn
      ? [
          droidnet.renderTitle("APN Information"),
          droidnet.renderTable(
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
              {
                label: "APN roaming protocol",
                value: apn.roaming_protocol || "-",
              },
              { label: "Bearer", value: apn.bearer || "-" },
              { label: "MVNO type", value: apn.mvno_type || "-" },
              { label: "MVNO value", value: apn.mvno_match_data || "-" },
            ],
            { col: 4 },
          ),
        ]
      : [];

    return E("div", { class: "cbi-map" }, [
      E(droidnet.header),
      E("div", { class: "cbi-section" }, networkMenu),
      ...(wirelesMenu.length
        ? [E("div", { class: "cbi-section" }, wirelesMenu)]
        : []),
      E("div", { class: "cbi-section" }, cellularMenu),
      ...(apnMenu.length ? [E("div", { class: "cbi-section" }, apnMenu)] : []),
    ]);
  },
});
