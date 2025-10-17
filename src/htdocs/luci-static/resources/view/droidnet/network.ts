/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require uci";
"require view";
"require ui";
"require droidnet";
"require tools/ui-renderer as UIRenderer";

// Data-driven architecture
interface NetworkConfig {
  sections: NetworkSection[];
}

interface NetworkSection {
  id: string;
  title: string;
  commands: NetworkCommand[];
  renderer: (data: Record<string, any>) => Record<string, any>;
}

interface NetworkCommand {
  id: string;
  shell: string;
  parser: (stdout: string) => any;
}

const NETWORK_CONFIG: NetworkConfig = {
  sections: [
    {
      id: "network_capabilities",
      title: "Network Configuration",
      commands: [
        {
          id: "connectivity",
          shell: "dumpsys connectivity",
          parser: (stdout) => ({ stdout }),
        },
      ],
      renderer: (data) => {
        const caps = data["connectivity"]?.stdout?.match(
          /Capabilities:\s*([^\s]+)/,
        );
        const dns = data["connectivity"]?.stdout?.match(
          /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
        );

        return {
          "Network capabilities": caps?.[1]?.split("&") || [],
          "DNS servers":
            dns?.[1]
              ?.split(",")
              .map((s: string) => s.trim().replace(/^\//, "")) || [],
        };
      },
    },
  ],
};

// Generic engine
async function loadDataDriven(): Promise<Record<string, any>> {
  const sectionData: Record<string, any> = {};

  for (const section of NETWORK_CONFIG.sections) {
    const commandResults: Record<string, any> = {};

    for (const command of section.commands) {
      commandResults[command.id] = await droidnet.exec(
        command.shell.split(" "),
        command.parser,
      );
    }

    sectionData[section.id] = commandResults;
  }

  return sectionData;
}

function renderDataDriven(data: Record<string, any>): HTMLElement[] {
  const results = NETWORK_CONFIG.sections
    .map((section) => {
      const sectionData = section.renderer(data[section.id] || {});
      const rows = Object.entries(sectionData).map(([label, value]) => ({
        label,
        value: Array.isArray(value) ? value.join(", ") : String(value),
      }));

      return rows.length > 0
        ? [UIRenderer.renderTitle(section.title), UIRenderer.renderTable(rows)]
        : null;
    })
    .filter(Boolean);

  return results.flat() as HTMLElement[];
}

// Original implementation below...
interface NetworkData {
  [key: string]: any;
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

// Data loading functions
async function loadNetworkData(): Promise<NetworkData> {
  const [networkInfo, deviceInfo, apnInfo] = await Promise.all([
    loadNetworkProperties(),
    loadDeviceInfo(),
    loadApnInfo(),
  ]);

  return Object.assign(networkInfo, deviceInfo, apnInfo);
}

// Helper function to parse getprop output with flexible format handling
function parseGetpropOutput(
  stdout: string,
  properties: Record<string, string>,
): Record<string, any> {
  const networkInfo: Record<string, any> = {};
  const lines = stdout.split("\n");

  for (const line of lines) {
    for (const property in properties) {
      if (line.includes("[" + property + "]")) {
        const value = line.split("]: [")[1]?.slice(0, -1).trim() || "";
        const key = properties[property];

        // Handle both single values and comma-separated arrays
        if (key && value.includes(",")) {
          const values = value.split(",").map((item) => item.trim());
          networkInfo[key] = values.map((v) => (v === "" ? "" : v));
        } else if (key) {
          // Single value - create array with empty second slot for consistency
          networkInfo[key] = [value || "", ""];
        }
        break;
      }
    }
  }

  // Set defaults for missing properties
  Object.values(properties).forEach((key) => {
    if (!networkInfo["hasOwnProperty"](key)) {
      networkInfo[key] = ["", ""];
    }
  });

  return networkInfo;
}

async function loadNetworkProperties(): Promise<Record<string, any>> {
  const properties = {
    // GSM Network Properties
    "gsm.operator.alpha": "operator",
    "gsm.network.type": "signal",
    "gsm.version.ril-impl": "driver",
    "gsm.version.baseband": "baseband",
    "gsm.operator.isroaming": "roaming",
    "gsm.operator.numeric": "operator_code",
    "gsm.operator.iso-country": "country_code",
    "gsm.voice.network.type": "voice_network",
    "gsm.current.phone-type": "phone_type",
    "gsm.defaultpdpcontext.active": "pdp_active",
    "gsm.facilitylock.state": "facility_lock",
    "gsm.nitz.time": "nitz_time",
    "gsm.nitz.time-elapsedtime": "nitz_elapsed",
    // Try both property names for PS roaming
    "gsm.operator.ispsroaming": "ps_roaming",
    "vendor.gsm.network.type": "vendor_network_type",

    // SIM Properties - handle both single and array formats
    "gsm.sim.operator.alpha": "sim_operator",
    "gsm.sim.operator.numeric": "mcc",
    "gsm.sim.operator.iso-country": "sim_country",
    "gsm.sim.state": "sim_state",
    "gsm.sim.acc": "sim_acc",
    "gsm.sim.gsmoperator.numeric": "sim_gsm_operator",
    "vendor.gsm.sim.state": "vendor_sim_state",

    // Multi-SIM Properties
    "ro.multisim.simslotcount": "sim_slots",
    "persist.radio.multisim.config": "multisim_config",
    "persist.radio.sim.onoff": "sim_onoff",
    "ro.vendor.multisim.simslotcount": "vendor_sim_slots",
    "sys.enterprise.billing.dualsim": "dual_sim_billing",

    // RIL Properties
    "ril.hasisim": "has_sim",
    "ril.sim.acc": "ril_sim_acc",
    "ril.sim.mobility0": "sim0_mobility",
    "ril.sim.mobility1": "sim1_mobility",
    "ril.simoperator": "ril_sim_operator",
    "ril.cold_sim": "cold_sim",
  };

  return droidnet.exec(["getprop"], (stdout: string) => {
    console.debug(
      "[network] getprop output:",
      stdout.substring(0, 500) + "...",
    );
    const networkInfo = parseGetpropOutput(stdout, properties);

    // Handle fallback for PS roaming if main property missing
    if (
      !networkInfo["ps_roaming"] ||
      (networkInfo["ps_roaming"][0] === "" &&
        networkInfo["ps_roaming"][1] === "")
    ) {
      // Use regular roaming as fallback
      networkInfo["ps_roaming"] = networkInfo["roaming"] || ["", ""];
    }

    console.debug("[network] parsed properties:", networkInfo);
    return networkInfo;
  });
}

async function loadDeviceInfo(): Promise<Record<string, any>> {
  const [imeiInfo, ipInfo, connectivityInfo, wifiInfo, dataInfo, airplaneInfo] =
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
      droidnet.exec(["ip", "route", "get", "1.1.1.1"], (stdout: string) => {
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
      droidnet.exec(["dumpsys", "connectivity"], (stdout: string) => {
        console.debug("[network] connectivity dump:", stdout);
        const connectivityData: Record<string, any> = {};

        // Extract interface name
        const interfaceMatch = stdout.match(/InterfaceName:\s*(\w+)/);
        if (interfaceMatch?.[1]) {
          connectivityData["interface"] = interfaceMatch[1];
        }

        // Extract link addresses
        const linkMatch = stdout.match(/LinkAddresses:\s*\[\s*([^\]]+)\s*\]/);
        if (linkMatch?.[1]) {
          connectivityData["link_addresses"] = linkMatch[1].trim();
        }

        // Extract DNS addresses
        const dnsMatch = stdout.match(/DnsAddresses:\s*\[\s*([^\]]+)\s*\]/);
        if (dnsMatch?.[1]) {
          const dnsAddresses = dnsMatch[1]
            .split(",")
            .map((addr) => addr.trim().replace(/^\//, ""))
            .filter((addr) => addr && addr !== "null");
          connectivityData["dns_servers"] = dnsAddresses;
        }

        // Extract MTU
        const mtuMatch = stdout.match(/MTU:\s*(\d+)/);
        if (mtuMatch?.[1]) {
          connectivityData["mtu"] = mtuMatch[1];
        }

        // Extract TCP buffer sizes
        const tcpMatch = stdout.match(/TcpBufferSizes:\s*([^\s]+)/);
        if (tcpMatch?.[1]) {
          connectivityData["tcp_buffer_sizes"] = tcpMatch[1];
        }

        // Extract routes
        const routesMatch = stdout.match(/Routes:\s*\[\s*([^\]]+)\s*\]/);
        if (routesMatch?.[1]) {
          const routes = routesMatch[1]
            .split(",")
            .map((route) => route.trim())
            .filter((route) => route);
          connectivityData["routes"] = routes;
        }

        // Extract network capabilities
        const capMatch = stdout.match(/Capabilities:\s*([^\s]+)/);
        if (capMatch?.[1]) {
          connectivityData["capabilities"] = capMatch[1].split("&");
        }

        // Extract bandwidth info
        const upBandwidthMatch = stdout.match(/LinkUpBandwidth>=(\d+)Kbps/);
        const downBandwidthMatch = stdout.match(/LinkDnBandwidth>=(\d+)Kbps/);
        if (upBandwidthMatch?.[1]) {
          const kbps = parseInt(upBandwidthMatch[1]);
          const mbps = kbps / 1000;
          connectivityData["upload_bandwidth"] =
            mbps >= 1 ? `${mbps} Mbps (${kbps} Kbps)` : `${kbps} Kbps`;
        }
        if (downBandwidthMatch?.[1]) {
          const kbps = parseInt(downBandwidthMatch[1]);
          const mbps = kbps / 1000;
          connectivityData["download_bandwidth"] =
            mbps >= 1 ? `${mbps} Mbps (${kbps} Kbps)` : `${kbps} Kbps`;
        }

        console.debug("[network] parsed connectivity:", connectivityData);
        return connectivityData;
      }),
      droidnet.exec(
        ["dumpsys", "wifi", "|", "grep", "Wi-Fi is"],
        (stdout: string) => {
          return { wifi: stdout.trim() === "Wi-Fi is enabled" };
        },
      ),
      droidnet.exec(["dumpsys", "telephony.registry"], (stdout: string) => {
        console.debug(
          "[network] telephony registry dump:",
          stdout.substring(0, 500) + "...",
        );
        const telephonyData: Record<string, any> = {};

        // Parse mDataConnectionState
        // Parse mDataConnectionState
        telephonyData["data"] = stdout.includes("mDataConnectionState=2");

        // Parse mServiceState
        const serviceStateMatch = stdout.match(/mServiceState=\{([^}]+)\}/);
        if (serviceStateMatch?.[1]) {
          const serviceState = serviceStateMatch[1];

          // Extract cell identity info
          const cellIdMatch = serviceState.match(/mCi=(\d+)/);
          const tacMatch = serviceState.match(/mTac=(\d+)/);
          const earfcnMatch = serviceState.match(/mEarfcn=(\d+)/);
          const pciMatch = serviceState.match(/mPci=(\d+)/);
          const channelMatch = serviceState.match(/mChannelNumber=(\d+)/);

          if (cellIdMatch?.[1]) telephonyData["cell_id"] = cellIdMatch[1];
          if (tacMatch?.[1]) telephonyData["tracking_area"] = tacMatch[1];
          if (earfcnMatch?.[1]) telephonyData["earfcn"] = earfcnMatch[1];
          if (pciMatch?.[1]) telephonyData["physical_cell_id"] = pciMatch[1];
          if (channelMatch?.[1])
            telephonyData["channel_number"] = channelMatch[1];

          // Extract registration states
          const voiceRegMatch = serviceState.match(
            /mVoiceRegState=(\d+)\(([^)]+)\)/,
          );
          const dataRegMatch = serviceState.match(
            /mDataRegState=(\d+)\(([^)]+)\)/,
          );

          if (voiceRegMatch)
            telephonyData["voice_reg_state"] = voiceRegMatch[2];
          if (dataRegMatch) telephonyData["data_reg_state"] = dataRegMatch[2];
        }

        // Parse signal strength - handle different formats
        const signalMatch = stdout.match(
          /mLte=CellSignalStrengthLte:\s*rssi=(-?\d+)\s*rsrp=(-?\d+)\s*rsrq=(-?\d+)\s*rssnr=(\d+)(?:\s*cqiTableIndex=\d+)?\s*cqi=(-?\d+)\s*ta=(-?\d+)\s*level=(\d+)/,
        );
        if (signalMatch) {
          telephonyData["lte_rssi"] =
            signalMatch[1] !== "2147483647" ? signalMatch[1] + " dBm" : "-";
          telephonyData["lte_rsrp"] =
            signalMatch[2] !== "2147483647" ? signalMatch[2] + " dBm" : "-";
          telephonyData["lte_rsrq"] =
            signalMatch[3] !== "2147483647" ? signalMatch[3] + " dB" : "-";
          telephonyData["lte_rssnr"] =
            signalMatch[4] !== "2147483647" ? signalMatch[4] : "-";
          telephonyData["lte_cqi"] =
            signalMatch[5] !== "2147483647" ? signalMatch[5] : "-";
          telephonyData["lte_ta"] =
            signalMatch[6] !== "2147483647" ? signalMatch[6] : "-";
          telephonyData["lte_level"] = signalMatch[7];
        }

        // Parse GSM signal - handle invalid values
        const gsmSignalMatch = stdout.match(
          /CellSignalStrengthGsm:\s*rssi=(-?\d+)\s*ber=(\d+)\s*mTa=(-?\d+)\s*mLevel=(\d+)/,
        );
        if (gsmSignalMatch) {
          telephonyData["gsm_rssi"] =
            gsmSignalMatch[1] !== "2147483647"
              ? gsmSignalMatch[1] + " dBm"
              : "-";
          telephonyData["gsm_ta"] =
            gsmSignalMatch[3] !== "2147483647" ? gsmSignalMatch[3] : "-";
          telephonyData["gsm_level"] = gsmSignalMatch[4];
        }

        // Parse WCDMA signal - handle invalid values
        const wcdmaSignalMatch = stdout.match(
          /CellSignalStrengthWcdma:\s*ss=(-?\d+)\s*ber=(\d+)/,
        );
        if (wcdmaSignalMatch) {
          telephonyData["wcdma_rssi"] =
            wcdmaSignalMatch[1] !== "2147483647"
              ? wcdmaSignalMatch[1] + " dBm"
              : "-";
          telephonyData["wcdma_level"] = "4";
        }

        // Parse 5G/NR status
        const nrStateMatch = stdout.match(/nrState=(\w+)/);
        const fiveGStatusMatch = stdout.match(/5gStatus=(\d+)/);
        const endcStatusMatch = stdout.match(/EndcStatus=(\d+)/);
        const carrierAggMatch = stdout.match(/isUsingCarrierAggregation=(\w+)/);

        if (nrStateMatch) telephonyData["nr_state"] = nrStateMatch[1];
        if (fiveGStatusMatch)
          telephonyData["five_g_status"] = fiveGStatusMatch[1];
        if (endcStatusMatch) telephonyData["endc_status"] = endcStatusMatch[1];
        if (carrierAggMatch)
          telephonyData["carrier_aggregation"] = carrierAggMatch[1] === "true";

        // Parse VoLTE and emergency support
        const vopsMatch = stdout.match(/mVopsSupport\s*=\s*(\d+)/);
        const emcMatch = stdout.match(/mEmcBearerSupport\s*=\s*(\d+)/);
        const imsVoiceMatch = stdout.match(/ImsVoiceAvail=(\d+)/);

        if (vopsMatch) telephonyData["volte_support"] = vopsMatch[1];
        if (emcMatch) telephonyData["emergency_support"] = emcMatch[1];
        if (imsVoiceMatch) telephonyData["ims_voice"] = imsVoiceMatch[1];

        // Parse available services
        const servicesMatch = stdout.match(/availableServices=\[([^\]]+)\]/);
        if (servicesMatch?.[1]) {
          telephonyData["available_services"] = servicesMatch[1]
            .split(",")
            .map((s) => s.trim());
        }

        console.debug("[network] parsed telephony:", telephonyData);
        return telephonyData;
      }),
      droidnet.exec(
        ["settings", "get", "global", "airplane_mode_on"],
        (stdout: string) => {
          return { airplane: stdout.trim() === "1" };
        },
      ),
    ]);

  return Object.assign(
    imeiInfo,
    ipInfo,
    connectivityInfo,
    wifiInfo,
    dataInfo,
    airplaneInfo,
  );
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
      onSuccess: (message, _result) => {
        UIRenderer.modalSuccess(message);
        droidnet.log(message);
      },
      onFailed: (error, _result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.log(error);
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
      onSuccess: (message, _result) => {
        UIRenderer.modalSuccess(message);
        droidnet.log(message);
      },
      onFailed: (error, _result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.log(error);
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
      onSuccess: (message, _result) => {
        UIRenderer.modalSuccess(message);
        droidnet.log(message);
      },
      onFailed: (error, _result) => {
        UIRenderer.modalError("Operation failed", error);
        droidnet.log(error);
      },
      validator: (result) => result.code === 0,
    },
  );

  return [
    UIRenderer.renderTitle("Mobile Network"),
    UIRenderer.renderTable([
      { label: "IP address", value: data["src"] || "-" },
      { label: "Gateway", value: data["via"] || "-" },
      { label: "Device", value: data["dev"] || "-" },
      { label: "Routing table", value: data["table"] || "-" },
      { label: "Wireless", value: data["wifi"] || false, action: wifiAction },
      {
        label: "Mobile data",
        value: data["data"] || false,
        action: dataAction,
      },
      {
        label: "Airplane mode",
        value: data["airplane"] || false,
        action: airplaneAction,
      },
    ]),
  ];
}

async function renderWirelessInfo(
  data: NetworkData,
): Promise<HTMLElement[] | null> {
  if (!data["wifi"]) return null;

  const wirelessInfo = await droidnet.exec([
    'dumpsys wifi | grep "mWifiInfo SSID"',
  ]);
  if (wirelessInfo.stderr || wirelessInfo.code != 0) return null;
  if (wirelessInfo.stdout) {
    const wifiInfo = parseWirelessInfo(wirelessInfo.stdout);
    return [
      UIRenderer.renderTitle("Wireless Information"),
      UIRenderer.renderTable([
        { label: "SSID", value: wifiInfo["ssid"] || "-" },
        { label: "BSSID", value: wifiInfo["bssid"] || "-" },
        { label: "MAC address", value: wifiInfo["mac"] || "-" },
        { label: "RSSI", value: wifiInfo["rssi"] || "-" },
        { label: "Link speed", value: wifiInfo["speed"] || "-" },
        { label: "Frequency", value: wifiInfo["frequency"] || "-" },
        ...(wifiInfo["type"]
          ? [{ label: "Type", value: wifiInfo["type"] }]
          : []),
      ]),
    ];
  }
  return null;
}

function renderCellularInfo(data: NetworkData): HTMLElement[] | null {
  const createSimTab = (simIndex: number, simName: string) => {
    if (!data["operator"]?.[simIndex]) return null;

    return {
      tabId: `sim${simIndex + 1}`,
      tabTitle: simName,
      tabContent: UIRenderer.renderTable([
        { label: "Operator name", value: data["operator"]?.[simIndex] || "-" },
        { label: "Network type", value: data["signal"]?.[simIndex] || "-" },
        { label: "Roaming mode", value: data["roaming"]?.[simIndex] || "-" },
        { label: "MCC", value: data["mcc"]?.[simIndex] || "-" },
        { label: "IMEI", value: data["imei_sim01"] || "-" },
        { label: "Driver", value: data["driver"] || "-" },
        { label: "Baseband", value: data["baseband"] || "-" },
      ]),
    };
  };

  const tabs = [createSimTab(0, "SIM 1"), createSimTab(1, "SIM 2")].filter(
    Boolean,
  );

  if (tabs.length === 0) return null;

  // Add system-wide cellular info
  const systemInfo = [];
  if (data["sim_slots"]) {
    systemInfo.push({ label: "SIM slots", value: data["sim_slots"] });
  }
  if (data["multisim_config"]) {
    systemInfo.push({
      label: "Multi-SIM config",
      value: data["multisim_config"],
    });
  }
  if (data["dual_sim_billing"]) {
    systemInfo.push({
      label: "Dual SIM billing",
      value: data["dual_sim_billing"],
    });
  }
  if (data["pdp_active"]) {
    systemInfo.push({ label: "PDP context active", value: data["pdp_active"] });
  }
  if (data["facility_lock"]) {
    systemInfo.push({ label: "Facility lock", value: data["facility_lock"] });
  }
  if (data["nitz_time"]) {
    const nitzDate = new Date(parseInt(data["nitz_time"]));
    systemInfo.push({
      label: "Network time",
      value: nitzDate.toLocaleString(),
    });
  }

  // Add connection history info
  if (data["data"]) {
    const connectionStatus = data["data"] ? "Connected" : "Disconnected";
    systemInfo.push({ label: "Data connection", value: connectionStatus });
  }

  const result = [UIRenderer.renderTitle("Cellular Information")];

  // if (systemInfo.length > 0) {
  result.push(UIRenderer.renderTable(systemInfo, { col: 3 }));
  // }

  result.push(UIRenderer.renderTab(tabs));

  return result;
}

function renderNetworkCapabilities(data: NetworkData): HTMLElement[] | null {
  console.debug("[network] renderNetworkCapabilities data:", data);

  const sections = [];

  // Network capabilities
  if (data["capabilities"] && data["capabilities"].length > 0) {
    sections.push(
      UIRenderer.renderTable([
        {
          label: "Network capabilities",
          value: data["capabilities"].join(", "),
        },
      ]),
    );
  }

  // Routes information
  if (data["routes"] && data["routes"].length > 0) {
    const routeData = data["routes"].map((route: string, index: number) => ({
      label: `Route ${index + 1}`,
      value: route,
    }));
    sections.push(UIRenderer.renderTable(routeData));
  }

  // TCP buffer sizes
  if (data["tcp_buffer_sizes"]) {
    const bufferSizes = data["tcp_buffer_sizes"].split(",");
    const bufferLabels = [
      "Read buffer min",
      "Read buffer default",
      "Read buffer max",
      "Write buffer min",
      "Write buffer default",
      "Write buffer max",
    ];

    const humanizeBytes = (bytes: number) => {
      const mb = bytes / (1024 * 1024);
      return mb >= 1
        ? `${mb.toFixed(1)} MB`
        : `${(bytes / 1024).toFixed(0)} KB`;
    };

    const bufferData = bufferSizes.map((size: string, index: number) => {
      const bytes = parseInt(size);
      const humanized = humanizeBytes(bytes);
      return {
        label: bufferLabels[index] || `Buffer ${index + 1}`,
        value: `${humanized} (${bytes.toLocaleString()} bytes)`,
      };
    });

    sections.push(UIRenderer.renderTable(bufferData, { col: 3 }));
  }

  if (sections.length === 0) return null;

  return [UIRenderer.renderTitle("Network Configuration"), ...sections];
}

function renderApnInfo(data: NetworkData): HTMLElement[] | null {
  if (!data["apn"] || Object.keys(data["apn"]).length === 0) return null;

  const apn = data["apn"];
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

  load: droidnet.load(loadDataDriven),

  render: async function (data: Record<string, any>): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    // Use only data-driven sections
    const sections = [renderDataDriven(data)];

    return UIRenderer.renderPage(sections);
  },
});
