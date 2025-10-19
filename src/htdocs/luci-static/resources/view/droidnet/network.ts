/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require uci";
"require view";
"require ui";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

// Parser infrastructure
interface ParsePattern {
  key: string;
  regex: RegExp;
  transform?: (match: RegExpMatchArray) => string | number | string[];
}

type ParsedData = Record<string, string | number | string[]>;

function parseWithPatterns(
  stdout: string,
  patterns: ParsePattern[],
): ParsedData {
  const result: ParsedData = {};

  for (const pattern of patterns) {
    const match = stdout.match(pattern.regex);
    if (match && match[1]) {
      result[pattern.key] = pattern.transform
        ? pattern.transform(match)
        : match[1];
    }
  }

  return result;
}

// Connectivity patterns - comprehensive (50+ fields)
const CONNECTIVITY_PATTERNS: ParsePattern[] = [
  { key: "networkId", regex: /network\{(\d+)\}/ },
  { key: "nethandle", regex: /nethandle\{(\d+)\}/ },
  {
    key: "networkType",
    regex: /type:\s*(\w+)\[(\w+)\]/,
    transform: (m) => (m[1] ? `${m[1]} (${m[2] || ""})` : ""),
  },
  {
    key: "state",
    regex: /state:\s*(\w+)\/(\w+)/,
    transform: (m) => m[1] || "",
  },
  { key: "reason", regex: /reason:\s*\(([^)]+)\)/ },
  { key: "extra", regex: /extra:\s*(\w+)/ },
  { key: "failover", regex: /failover:\s*(\w+)/ },
  { key: "available", regex: /available:\s*(\w+)/ },
  { key: "roaming", regex: /roaming:\s*(\w+)/ },
  { key: "interfaceName", regex: /InterfaceName:\s*(\w+)/ },
  {
    key: "ipAddress",
    regex: /LinkAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) => (m[1] ? m[1].trim() : ""),
  },
  {
    key: "dnsServers",
    regex: /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) =>
      m[1]
        ? m[1].split(",").map((s: string) => s.trim().replace(/^\//, ""))
        : [],
  },
  { key: "domains", regex: /Domains:\s*(\S+)/ },
  { key: "mtu", regex: /MTU:\s*(\d+)/ },
  { key: "tcpBufferSizes", regex: /TcpBufferSizes:\s*([^\s]+)/ },
  {
    key: "routes",
    regex: /Routes:\s*\[([^\]]+)\]/,
    transform: (m) => (m[1] ? m[1].trim() : ""),
  },
  {
    key: "capabilities",
    regex: /Capabilities:\s*([^\s]+)/,
    transform: (m) => (m[1] ? m[1].split("&") : []),
  },
  { key: "transports", regex: /Transports:\s*(\w+)/ },
  { key: "bandwidthUp", regex: /LinkUpBandwidth>=(\d+)Kbps/ },
  { key: "bandwidthDown", regex: /LinkDnBandwidth>=(\d+)Kbps/ },
  { key: "specifier", regex: /Specifier:\s*<(\d+)>/ },
  { key: "score", regex: /Score\{(\d+)\}/ },
  { key: "everValidated", regex: /everValidated\{(\w+)\}/ },
  { key: "lastValidated", regex: /lastValidated\{(\w+)\}/ },
  { key: "created", regex: /created\{(\w+)\}/ },
  { key: "lingering", regex: /lingering\{(\w+)\}/ },
  { key: "explicitlySelected", regex: /explicitlySelected\{(\w+)\}/ },
  { key: "acceptUnvalidated", regex: /acceptUnvalidated\{(\w+)\}/ },
  { key: "everCaptivePortal", regex: /everCaptivePortalDetected\{(\w+)\}/ },
  { key: "lastCaptivePortal", regex: /lastCaptivePortalDetected\{(\w+)\}/ },
  {
    key: "captivePortalPending",
    regex: /captivePortalValidationPending\{(\w+)\}/,
  },
  { key: "partialConnectivity", regex: /partialConnectivity\{(\w+)\}/ },
  {
    key: "acceptPartialConnectivity",
    regex: /acceptPartialConnectivity\{(\w+)\}/,
  },
  { key: "clatState", regex: /mState:\s*(\w+)/ },
  { key: "restrictBackground", regex: /Restrict background:\s*(\w+)/ },
  { key: "tetherSubId", regex: /subId:\s*(\d+)/ },
  { key: "tetherableUsb", regex: /tetherableUsbRegexs:\s*\[([^\]]+)\]/ },
  { key: "tetherableWifi", regex: /tetherableWifiRegexs:\s*\[([^\]]+)\]/ },
  {
    key: "tetherableBluetooth",
    regex: /tetherableBluetoothRegexs:\s*\[([^\]]+)\]/,
  },
  {
    key: "tetherableEthernet",
    regex: /tetherableEthernetRegexs:\s*\[([^\]]+)\]/,
  },
  { key: "isDunRequired", regex: /isDunRequired:\s*(\w+)/ },
  { key: "upstreamAuto", regex: /chooseUpstreamAutomatically:\s*(\w+)/ },
  { key: "defaultDns", regex: /defaultIPv4DNS:\s*\[([^\]]+)\]/ },
  {
    key: "upstreamInterface",
    regex: /Current upstream interface\(s\):\s*\[([^\]]+)\]/,
  },
];

// Telephony patterns - comprehensive (60+ fields)
const TELEPHONY_PATTERNS: ParsePattern[] = [
  {
    key: "voiceRegState",
    regex: /mVoiceRegState=(\d+)\(([^)]+)\)/,
    transform: (m) => m[2] || "",
  },
  {
    key: "dataRegState",
    regex: /mDataRegState=(\d+)\(([^)]+)\)/,
    transform: (m) => m[2] || "",
  },
  { key: "channelNumber", regex: /mChannelNumber=(\d+)/ },
  { key: "duplexMode", regex: /duplexMode\(\)=(\d+)/ },
  { key: "manualSelection", regex: /isManualNetworkSelection=(\w+)/ },
  {
    key: "voiceRadioTech",
    regex: /getRilVoiceRadioTechnology[=:](\d+)\((\w+)\)/,
    transform: (m) => m[2] || "",
  },
  {
    key: "dataRadioTech",
    regex: /getRilDataRadioTechnology[=:](\d+)\((\w+)\)/,
    transform: (m) => m[2] || "",
  },
  { key: "cssIndicator", regex: /mCssIndicator=(\w+)/ },
  { key: "cdmaRoaming", regex: /mCdmaRoamingIndicator=(-?\d+)/ },
  { key: "voiceRegType", regex: /VoiceRegType=(\d+)/ },
  { key: "imsVoiceAvail", regex: /ImsVoiceAvail=(\d+)/ },
  { key: "snap", regex: /Snap=(\d+)/ },
  { key: "mobileVoice", regex: /MobileVoice=(\w+)/ },
  { key: "mobileVoiceRat", regex: /MobileVoiceRat=(\w+)/ },
  { key: "mobileData", regex: /MobileData=(\w+)/ },
  { key: "mobileDataRoaming", regex: /MobileDataRoamingType=(\w+)/ },
  { key: "mobileDataRat", regex: /MobileDataRat=(\w+)/ },
  { key: "psOnly", regex: /PsOnly=(\w+)/ },
  { key: "femtocell", regex: /FemtocellInd=(\d+)/ },
  { key: "endcStatus", regex: /EndcStatus=(\d+)/ },
  { key: "restrictDcnr", regex: /RestrictDcnr=(\d+)/ },
  { key: "nrBearerStatus", regex: /NrBearerStatus=(\d+)/ },
  { key: "fiveGStatus", regex: /5gStatus=(\d+)/ },
  { key: "rrcState", regex: /RRCState=(-?\d+)/ },
  { key: "nrIconType", regex: /NrIconType=(\d+)/ },
  { key: "emergencyOnly", regex: /mIsEmergencyOnly=(\w+)/ },
  { key: "carrierAggregation", regex: /isUsingCarrierAggregation=(\w+)/ },
  { key: "lteEarfcnRsrpBoost", regex: /mLteEarfcnRsrpBoost=(\d+)/ },
  { key: "nrFrequencyRange", regex: /mNrFrequencyRange=(-?\d+)/ },
  { key: "iwlanPreferred", regex: /mIsIwlanPreferred=(\w+)/ },
  { key: "registrationState", regex: /registrationState=(\w+)/ },
  { key: "roamingType", regex: /roamingType=(\w+)/ },
  { key: "accessNetworkTech", regex: /accessNetworkTechnology=(\w+)/ },
  { key: "rejectCause", regex: /rejectCause=(\d+)/ },
  { key: "emergencyEnabled", regex: /emergencyEnabled=(\w+)/ },
  { key: "availableServices", regex: /availableServices=\[([^\]]*)\]/ },
  { key: "cellId", regex: /mCi=(\d+)/ },
  { key: "pci", regex: /mPci=(\d+)/ },
  { key: "tac", regex: /mTac=(\d+)/ },
  { key: "earfcn", regex: /mEarfcn=(\d+)/ },
  { key: "bandwidth", regex: /mBandwidth=(\d+)/ },
  { key: "mcc", regex: /mMcc=(\d+)/ },
  { key: "mnc", regex: /mMnc=(\d+)/ },
  { key: "carrier", regex: /mAlphaLong=(\w+)/ },
  { key: "carrierShort", regex: /mAlphaShort=(\w+)/ },
  { key: "cssSupported", regex: /mCssSupported=(\w+)/ },
  { key: "roamingIndicator", regex: /mRoamingIndicator=(\d+)/ },
  { key: "systemInPrl", regex: /mSystemIsInPrl=(\d+)/ },
  { key: "maxDataCalls", regex: /maxDataCalls\s*=\s*(\d+)/ },
  { key: "dcNrRestricted", regex: /isDcNrRestricted\s*=\s*(\w+)/ },
  { key: "nrAvailable", regex: /isNrAvailable\s*=\s*(\w+)/ },
  { key: "enDcAvailable", regex: /isEnDcAvailable\s*=\s*(\w+)/ },
  { key: "vopsSupport", regex: /mVopsSupport\s*=\s*(\d+)/ },
  { key: "emcBearerSupport", regex: /mEmcBearerSupport\s*=\s*(\d+)/ },
  { key: "signalRssi", regex: /rssi=(-?\d+)/ },
  { key: "signalRsrp", regex: /rsrp=(-?\d+)/ },
  { key: "signalRsrq", regex: /rsrq=(-?\d+)/ },
  { key: "signalRssnr", regex: /rssnr=(-?\d+)/ },
  { key: "signalCqi", regex: /cqi=(\d+)/ },
  { key: "signalTa", regex: /ta=(\d+)/ },
  { key: "signalLevel", regex: /level=(\d+)/ },
  { key: "signalBer", regex: /ber=(\d+)/ },
  { key: "callState", regex: /mCallState=(\d+)/ },
  { key: "dataState", regex: /mDataConnectionState=(\d+)/ },
  { key: "dataActivity", regex: /mDataActivity=(\d+)/ },
  { key: "messageWaiting", regex: /mMessageWaiting=(\w+)/ },
  { key: "callForwarding", regex: /mCallForwarding=(\w+)/ },
  { key: "voiceActivation", regex: /mVoiceActivationState=\s*(\d+)/ },
  { key: "dataActivation", regex: /mDataActivationState=\s*(\d+)/ },
  { key: "userMobileData", regex: /mUserMobileDataState=\s*(\w+)/ },
  { key: "srvccState", regex: /mSrvccState=(-?\d+)/ },
  { key: "otaspMode", regex: /mOtaspMode=(\d+)/ },
  { key: "defaultSubId", regex: /mDefaultSubId=(\d+)/ },
  { key: "defaultPhoneId", regex: /mDefaultPhoneId=(\d+)/ },
  { key: "activeDataSubId", regex: /mActiveDataSubId=(\d+)/ },
  { key: "radioPowerState", regex: /mRadioPowerState=(\d+)/ },
];

// Data-driven architecture
interface NetworkConfig {
  sections: NetworkSection[];
}

interface NetworkSection {
  id: string;
  title: string;
  commands: NetworkCommand[];
  renderer: (
    data: Record<string, ParsedData>,
  ) => Record<string, string[] | string>;
}

interface NetworkCommand {
  id: string;
  shell: string;
  parser: (stdout: string) => ParsedData;
}

const NETWORK_CONFIG: NetworkConfig = {
  sections: [
    {
      id: "network_info",
      title: "Network Information",
      commands: [
        {
          id: "connectivity",
          shell: "dumpsys connectivity",
          parser: (stdout) => parseWithPatterns(stdout, CONNECTIVITY_PATTERNS),
        },
      ],
      renderer: (data) => {
        const conn = data["connectivity"] || {};
        const dnsServers = conn["dnsServers"];
        const capabilities = conn["capabilities"];

        return {
          "Network ID": String(conn["networkId"] || ""),
          "Net Handle": String(conn["nethandle"] || ""),
          "Network Type": String(conn["networkType"] || ""),
          State: String(conn["state"] || ""),
          Reason: String(conn["reason"] || ""),
          Extra: String(conn["extra"] || ""),
          Failover: String(conn["failover"] || ""),
          Available: String(conn["available"] || ""),
          Roaming: String(conn["roaming"] || ""),
          Interface: String(conn["interfaceName"] || ""),
          "IP Address": String(conn["ipAddress"] || ""),
          "DNS Servers": Array.isArray(dnsServers) ? dnsServers : [],
          Domains: String(conn["domains"] || ""),
          Gateway: String(conn["routes"] || ""),
          MTU: String(conn["mtu"] || ""),
          "TCP Buffers": String(conn["tcpBufferSizes"] || ""),
          Transports: String(conn["transports"] || ""),
          "Upload Bandwidth": conn["bandwidthUp"]
            ? `${conn["bandwidthUp"]} Kbps`
            : "",
          "Download Bandwidth": conn["bandwidthDown"]
            ? `${conn["bandwidthDown"]} Kbps`
            : "",
          Specifier: String(conn["specifier"] || ""),
          Score: String(conn["score"] || ""),
          "Ever Validated": String(conn["everValidated"] || ""),
          "Last Validated": String(conn["lastValidated"] || ""),
          Created: String(conn["created"] || ""),
          Lingering: String(conn["lingering"] || ""),
          "Explicitly Selected": String(conn["explicitlySelected"] || ""),
          "Accept Unvalidated": String(conn["acceptUnvalidated"] || ""),
          "Ever Captive Portal": String(conn["everCaptivePortal"] || ""),
          "Last Captive Portal": String(conn["lastCaptivePortal"] || ""),
          "Captive Portal Pending": String(conn["captivePortalPending"] || ""),
          "Partial Connectivity": String(conn["partialConnectivity"] || ""),
          "Accept Partial": String(conn["acceptPartialConnectivity"] || ""),
          "CLAT State": String(conn["clatState"] || ""),
          "Restrict Background": String(conn["restrictBackground"] || ""),
          "Tether Sub ID": String(conn["tetherSubId"] || ""),
          "Tetherable USB": String(conn["tetherableUsb"] || ""),
          "Tetherable WiFi": String(conn["tetherableWifi"] || ""),
          "Tetherable Bluetooth": String(conn["tetherableBluetooth"] || ""),
          "Tetherable Ethernet": String(conn["tetherableEthernet"] || ""),
          "DUN Required": String(conn["isDunRequired"] || ""),
          "Upstream Auto": String(conn["upstreamAuto"] || ""),
          "Default DNS": String(conn["defaultDns"] || ""),
          "Upstream Interface": String(conn["upstreamInterface"] || ""),
          Capabilities: Array.isArray(capabilities) ? capabilities : [],
        };
      },
    },
    {
      id: "cellular_info",
      title: "Cellular Information",
      commands: [
        {
          id: "telephony",
          shell: "dumpsys telephony.registry",
          parser: (stdout) => parseWithPatterns(stdout, TELEPHONY_PATTERNS),
        },
      ],
      renderer: (data) => {
        const tel = data["telephony"] || {};

        return {
          "Voice Registration": String(tel["voiceRegState"] || ""),
          "Data Registration": String(tel["dataRegState"] || ""),
          "Channel Number": String(tel["channelNumber"] || ""),
          "Duplex Mode": String(tel["duplexMode"] || ""),
          "Manual Selection": String(tel["manualSelection"] || ""),
          "Voice Radio Tech": String(tel["voiceRadioTech"] || ""),
          "Data Radio Tech": String(tel["dataRadioTech"] || ""),
          "CSS Indicator": String(tel["cssIndicator"] || ""),
          "CDMA Roaming": String(tel["cdmaRoaming"] || ""),
          "Voice Reg Type": String(tel["voiceRegType"] || ""),
          "IMS Voice Avail": String(tel["imsVoiceAvail"] || ""),
          SNAP: String(tel["snap"] || ""),
          "Mobile Voice": String(tel["mobileVoice"] || ""),
          "Mobile Voice RAT": String(tel["mobileVoiceRat"] || ""),
          "Mobile Data": String(tel["mobileData"] || ""),
          "Mobile Data Roaming": String(tel["mobileDataRoaming"] || ""),
          "Mobile Data RAT": String(tel["mobileDataRat"] || ""),
          "PS Only": String(tel["psOnly"] || ""),
          Femtocell: String(tel["femtocell"] || ""),
          "EN-DC Status": String(tel["endcStatus"] || ""),
          "Restrict DC-NR": String(tel["restrictDcnr"] || ""),
          "NR Bearer Status": String(tel["nrBearerStatus"] || ""),
          "5G Status": String(tel["fiveGStatus"] || ""),
          "RRC State": String(tel["rrcState"] || ""),
          "NR Icon Type": String(tel["nrIconType"] || ""),
          "Emergency Only": String(tel["emergencyOnly"] || ""),
          "Carrier Aggregation": String(tel["carrierAggregation"] || ""),
          "LTE EARFCN RSRP Boost": String(tel["lteEarfcnRsrpBoost"] || ""),
          "NR Frequency Range": String(tel["nrFrequencyRange"] || ""),
          "IWLAN Preferred": String(tel["iwlanPreferred"] || ""),
          "Registration State": String(tel["registrationState"] || ""),
          "Roaming Type": String(tel["roamingType"] || ""),
          "Access Network Tech": String(tel["accessNetworkTech"] || ""),
          "Reject Cause": String(tel["rejectCause"] || ""),
          "Emergency Enabled": String(tel["emergencyEnabled"] || ""),
          "Available Services": String(tel["availableServices"] || ""),
          "Cell ID": String(tel["cellId"] || ""),
          "Physical Cell ID": String(tel["pci"] || ""),
          "Tracking Area Code": String(tel["tac"] || ""),
          EARFCN: String(tel["earfcn"] || ""),
          Bandwidth: String(tel["bandwidth"] || ""),
          MCC: String(tel["mcc"] || ""),
          MNC: String(tel["mnc"] || ""),
          Carrier: String(tel["carrier"] || ""),
          "Carrier Short": String(tel["carrierShort"] || ""),
          "CSS Supported": String(tel["cssSupported"] || ""),
          "Roaming Indicator": String(tel["roamingIndicator"] || ""),
          "System In PRL": String(tel["systemInPrl"] || ""),
          "Max Data Calls": String(tel["maxDataCalls"] || ""),
          "DC-NR Restricted": String(tel["dcNrRestricted"] || ""),
          "NR Available": String(tel["nrAvailable"] || ""),
          "EN-DC Available": String(tel["enDcAvailable"] || ""),
          "VoPS Support": String(tel["vopsSupport"] || ""),
          "EMC Bearer Support": String(tel["emcBearerSupport"] || ""),
          "Signal RSSI": String(tel["signalRssi"] || ""),
          "Signal RSRP": String(tel["signalRsrp"] || ""),
          "Signal RSRQ": String(tel["signalRsrq"] || ""),
          "Signal RSSNR": String(tel["signalRssnr"] || ""),
          "Signal CQI": String(tel["signalCqi"] || ""),
          "Signal TA": String(tel["signalTa"] || ""),
          "Signal Level": String(tel["signalLevel"] || ""),
          "Signal BER": String(tel["signalBer"] || ""),
          "Call State": String(tel["callState"] || ""),
          "Data State":
            tel["dataState"] === "2"
              ? "Connected"
              : tel["dataState"] === "0"
                ? "Disconnected"
                : String(tel["dataState"] || ""),
          "Data Activity": String(tel["dataActivity"] || ""),
          "Message Waiting": String(tel["messageWaiting"] || ""),
          "Call Forwarding": String(tel["callForwarding"] || ""),
          "Voice Activation": String(tel["voiceActivation"] || ""),
          "Data Activation": String(tel["dataActivation"] || ""),
          "User Mobile Data": String(tel["userMobileData"] || ""),
          "SRVCC State": String(tel["srvccState"] || ""),
          "OTASP Mode": String(tel["otaspMode"] || ""),
          "Default Sub ID": String(tel["defaultSubId"] || ""),
          "Default Phone ID": String(tel["defaultPhoneId"] || ""),
          "Active Data Sub ID": String(tel["activeDataSubId"] || ""),
          "Radio Power State": String(tel["radioPowerState"] || ""),
        };
      },
    },
  ],
};

// Generic engine
async function loadDataDriven(): Promise<
  Record<string, Record<string, ParsedData>>
> {
  const sectionData: Record<string, Record<string, ParsedData>> = {};

  for (const section of NETWORK_CONFIG.sections) {
    const commandResults: Record<string, ParsedData> = {};

    for (const command of section.commands) {
      const result = await DroidNet.exec(command.shell.split(" "));
      commandResults[command.id] = command.parser(result.stdout || "");
    }

    sectionData[section.id] = commandResults;
  }

  return sectionData;
}

function renderDataDriven(
  data: Record<string, Record<string, ParsedData>>,
): HTMLElement[] {
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

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend(
  DroidNet.createView({
    load: loadDataDriven,
    render: (
      data: Record<string, Record<string, ParsedData>> & DeviceStatus,
    ) => [renderDataDriven(data)],
  }),
);
