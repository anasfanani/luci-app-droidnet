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

// WiFi patterns
const WIFI_PATTERNS: ParsePattern[] = [
  { key: "wifiEnabled", regex: /Wi-Fi is (\w+)/ },
  { key: "verboseLogging", regex: /Verbose logging is (\w+)/ },
  { key: "stayAwake", regex: /Stay-awake conditions:\s*(\d+)/ },
  { key: "idleMode", regex: /mInIdleMode\s+(\w+)/ },
  { key: "scanPending", regex: /mScanPending\s+(\w+)/ },
  { key: "vendor", regex: /Wi-Fi vendor:\s*(.+)/ },
  { key: "supportedFeature", regex: /Supported feature:\s*(\d+)/ },
];

// Battery patterns
const BATTERY_PATTERNS: ParsePattern[] = [
  { key: "acPowered", regex: /AC powered:\s*(\w+)/ },
  { key: "usbPowered", regex: /USB powered:\s*(\w+)/ },
  { key: "wirelessPowered", regex: /Wireless powered:\s*(\w+)/ },
  { key: "maxChargingCurrent", regex: /Max charging current:\s*(\d+)/ },
  { key: "maxChargingVoltage", regex: /Max charging voltage:\s*(\d+)/ },
  { key: "chargeCounter", regex: /Charge counter:\s*(\d+)/ },
  { key: "status", regex: /status:\s*(\d+)/ },
  { key: "health", regex: /health:\s*(\d+)/ },
  { key: "present", regex: /present:\s*(\w+)/ },
  { key: "level", regex: /level:\s*(\d+)/ },
  { key: "scale", regex: /scale:\s*(\d+)/ },
  { key: "voltage", regex: /voltage:\s*(\d+)/ },
  { key: "temperature", regex: /temperature:\s*(\d+)/ },
  { key: "technology", regex: /technology:\s*(.+)/ },
  { key: "currentNow", regex: /current now:\s*(\d+)/ },
  { key: "ledCharging", regex: /LED Charging:\s*(\w+)/ },
  { key: "ledLowBattery", regex: /LED Low Battery:\s*(\w+)/ },
  { key: "fastCharging", regex: /Adaptive Fast Charging Settings:\s*(\w+)/ },
  { key: "superFastCharging", regex: /Super Fast Charging Settings:\s*(\w+)/ },
];

// NetStats patterns
const NETSTATS_PATTERNS: ParsePattern[] = [
  { key: "activeInterface", regex: /Active interfaces:\s+iface=(\w+)/ },
  { key: "interfaceType", regex: /type=(\w+)/ },
  { key: "interfaceSubType", regex: /subType=(\w+)/ },
  { key: "metered", regex: /metered=(\w+)/ },
  { key: "defaultNetwork", regex: /defaultNetwork=(\w+)/ },
  { key: "pendingBytes", regex: /Pending bytes:\s*(\d+)/ },
];

// NetPolicy patterns
const NETPOLICY_PATTERNS: ParsePattern[] = [
  { key: "systemReady", regex: /System ready:\s*(\w+)/ },
  { key: "restrictBackground", regex: /Restrict background:\s*(\w+)/ },
  { key: "restrictPower", regex: /Restrict power:\s*(\w+)/ },
  { key: "deviceIdle", regex: /Device idle:\s*(\w+)/ },
  { key: "meteredIfaces", regex: /Metered ifaces:\s*\{([^}]+)\}/ },
  { key: "charging", regex: /Charging:\s*(\w+)/ },
];

// Phone patterns
const PHONE_PATTERNS: ParsePattern[] = [
  { key: "phoneId", regex: /PHONE_ID=(\d+)/ },
  { key: "subscriptionId", regex: /SUBSCRIPTION_ID=(\d+)/ },
  { key: "sortOrder", regex: /SORT_ORDER=(\d+)/ },
  { key: "csVideoCalling", regex: /CS_VIDEO_CALLING=(\w+)/ },
  { key: "psVideoCalling", regex: /PS_VIDEO_CALLING=(\w+)/ },
];

// USB patterns
const USB_PATTERNS: ParsePattern[] = [
  { key: "bootCompleted", regex: /mBootCompleted:(\w+)/ },
  { key: "simCount", regex: /All SIM Count:(\d+)/ },
  { key: "mpsmSupport", regex: /SUPPORT MPSM\s*:(\w+)/ },
  { key: "mpsmEnabled", regex: /MPSM ON\/OFF\s*:(\w+)/ },
  { key: "simBlock", regex: /SIM BLOCK ON\/OFF\s*:(\w+)/ },
  { key: "mdmBlock", regex: /MDM BLOCK ON\/OFF\s*:(\w+)/ },
  { key: "dexMode", regex: /DexModeObserver state:(\w+)/ },
  {
    key: "notificationReady",
    regex: /Notification\s*:\s*\n\s*ready\s*:\s*(\w+)/,
  },
  { key: "connected", regex: /connected=(\w+)/ },
  { key: "configured", regex: /configured=(\w+)/ },
  { key: "currentMode", regex: /current_mode=(\w+)/ },
  { key: "powerRole", regex: /power_role=(\w+)/ },
  { key: "dataRole", regex: /data_role=(\w+)/ },
  { key: "usbCharging", regex: /usb_charging=(\w+)/ },
  { key: "kernelState", regex: /kernel_state=(\w+)/ },
  { key: "kernelFunctions", regex: /kernel_function_list=([^\s]+)/ },
  {
    key: "currentFunctions",
    regex: /current_functions=\[\s*([^\]]+)\]/,
    transform: (m) => (m[1] || "").trim().replace(/\s+/g, ", "),
  },
  { key: "functionsApplied", regex: /current_functions_applied=(\w+)/ },
  { key: "screenUnlockedFunctions", regex: /screen_unlocked_functions=(\w+)/ },
  { key: "screenLocked", regex: /screen_locked=(\w+)/ },
  { key: "hostConnected", regex: /host_connected=(\w+)/ },
  { key: "sourcePower", regex: /source_power=(\w+)/ },
  { key: "sinkPower", regex: /sink_power=(\w+)/ },
  { key: "hideNotification", regex: /hide_usb_notification=(\w+)/ },
  { key: "audioAccessory", regex: /audio_accessory_connected=(\w+)/ },
  { key: "numConnects", regex: /num_connects=(\d+)/ },
  { key: "portId", regex: /id=(port\d+)/ },
  { key: "supportedModes", regex: /supported_modes=(\w+)/ },
  { key: "simulationActive", regex: /is_simulation_active=(\w+)/ },
  { key: "canChangeMode", regex: /can_change_mode=(\w+)/ },
  { key: "canChangePowerRole", regex: /can_change_power_role=(\w+)/ },
  { key: "canChangeDataRole", regex: /can_change_data_role=(\w+)/ },
  { key: "contaminantStatus", regex: /contaminant_presence_status=([^\s]+)/ },
  { key: "connectedAtMillis", regex: /connected_at_millis=(\d+)/ },
  { key: "alsaCards", regex: /cards_parser=(-?\d+)/ },
];

// Location patterns
const LOCATION_PATTERNS: ParsePattern[] = [
  { key: "currentUser", regex: /Current user:\s*(\d+)/ },
  { key: "locationMode", regex: /Location mode:\s*(\w+)/ },
  { key: "batterySaverMode", regex: /Battery Saver Location Mode:\s*(\S+)/ },
];

// Device Policy patterns
const DEVICE_POLICY_PATTERNS: ParsePattern[] = [
  { key: "provisioningState", regex: /provisioningState:\s*(\d+)/ },
  { key: "passwordOwner", regex: /mPasswordOwner=(-?\d+)/ },
  { key: "encryptionStatus", regex: /Encryption Status:\s*(\w+)/ },
  {
    key: "screenCaptureDisabled",
    regex: /Screen capture disabled:\s*\{0=(\w+)\}/,
  },
  { key: "passwordQuality", regex: /Password quality:\s*\{0=(\d+)\}/ },
];

// Device Idle patterns
const DEVICEIDLE_PATTERNS: ParsePattern[] = [
  { key: "lightAfterInactive", regex: /light_after_inactive_to=\+([^\s]+)/ },
  { key: "lightIdleTo", regex: /light_idle_to=\+([^\s]+)/ },
  { key: "lightMaxIdleTo", regex: /light_max_idle_to=\+([^\s]+)/ },
  { key: "inactiveTo", regex: /inactive_to=\+([^\s]+)/ },
  { key: "idleAfterInactive", regex: /idle_after_inactive_to=\+([^\s]+)/ },
  { key: "idleTo", regex: /idle_to=\+([^\s]+)/ },
  { key: "maxIdleTo", regex: /max_idle_to=\+([^\s]+)/ },
  { key: "waitForUnlock", regex: /wait_for_unlock=(\w+)/ },
];

// Battery Extended patterns
const BATTERY_EXT_PATTERNS: ParsePattern[] = [
  { key: "batteryMiscEvent", regex: /batteryMiscEvent:\s*(\d+)/ },
  { key: "batteryCurrentEvent", regex: /batteryCurrentEvent:\s*(\d+)/ },
  { key: "plugTypeSummary", regex: /mSecPlugTypeSummary:\s*(\d+)/ },
  {
    key: "wirelessFastCharger",
    regex: /mWirelessFastChargingSettingsEnable:\s*(\w+)/,
  },
  { key: "savedBatteryAsoc", regex: /mSavedBatteryAsoc:\s*(\d+)/ },
  { key: "savedBatteryMaxTemp", regex: /mSavedBatteryMaxTemp:\s*(\d+)/ },
  { key: "savedBatteryMaxCurrent", regex: /mSavedBatteryMaxCurrent:\s*(\d+)/ },
  { key: "savedBatteryUsage", regex: /mSavedBatteryUsage:\s*(\d+)/ },
];

// Display patterns
const DISPLAY_PATTERNS: ParsePattern[] = [
  { key: "displayState", regex: /mGlobalDisplayState=(\w+)/ },
  { key: "nextDisplayId", regex: /mNextNonDefaultDisplayId=(\d+)/ },
  {
    key: "stableDisplaySize",
    regex: /mStableDisplaySize=Point\((\d+),\s*(\d+)\)/,
    transform: (m) => `${m[1]}x${m[2]}`,
  },
  { key: "wifiDisplayScanCount", regex: /mWifiDisplayScanRequestCount=(\d+)/ },
  { key: "wifiDisplayFeatureState", regex: /featureState=(\d+)/ },
  { key: "wifiDisplayScanState", regex: /scanState=(\d+)/ },
  { key: "wifiP2pEnabled", regex: /mWifiP2pEnabled=(\w+)/ },
  { key: "wfdEnabled", regex: /mWfdEnabled=(\w+)/ },
];

// Power patterns
const POWER_PATTERNS: ParsePattern[] = [
  { key: "wakefulness", regex: /mWakefulness=(\w+)/ },
  { key: "isPowered", regex: /mIsPowered=(\w+)/ },
  { key: "plugType", regex: /mPlugType=(\d+)/ },
  { key: "batteryLevel", regex: /mBatteryLevel=(\d+)/ },
  { key: "stayOn", regex: /mStayOn=(\w+)/ },
  { key: "bootCompleted", regex: /mBootCompleted=(\w+)/ },
  { key: "systemReady", regex: /mSystemReady=(\w+)/ },
  { key: "batteryLevelLow", regex: /mBatteryLevelLow=(\w+)/ },
  { key: "lightDeviceIdleMode", regex: /mLightDeviceIdleMode=(\w+)/ },
  { key: "deviceIdleMode", regex: /mDeviceIdleMode=(\w+)/ },
  { key: "displayReady", regex: /mDisplayReady=(\w+)/ },
];

// Alarm patterns
const ALARM_PATTERNS: ParsePattern[] = [
  { key: "minFuturity", regex: /min_futurity=\+([^\s]+)/ },
  { key: "minInterval", regex: /min_interval=\+([^\s]+)/ },
  { key: "maxInterval", regex: /max_interval=\+([^\s]+)/ },
  { key: "maxAlarmsPerUid", regex: /max_alarms_per_uid=(\d+)/ },
  { key: "appStandbyEnabled", regex: /app_standby_quotas_enabled=(\w+)/ },
  { key: "forceAppStandby", regex: /Force all apps standby:\s*(\w+)/ },
  { key: "pluggedIn", regex: /Plugged In:\s*(\w+)/ },
];

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
    {
      id: "wifi_info",
      title: "WiFi Information",
      commands: [
        {
          id: "wifi",
          shell: "dumpsys wifi",
          parser: (stdout) => parseWithPatterns(stdout, WIFI_PATTERNS),
        },
      ],
      renderer: (data) => {
        const wifi = data["wifi"] || {};

        return {
          "WiFi Status": String(wifi["wifiEnabled"] || ""),
          "Verbose Logging": String(wifi["verboseLogging"] || ""),
          "Stay Awake": String(wifi["stayAwake"] || ""),
          "Idle Mode": String(wifi["idleMode"] || ""),
          "Scan Pending": String(wifi["scanPending"] || ""),
          Vendor: String(wifi["vendor"] || ""),
          "Supported Feature": String(wifi["supportedFeature"] || ""),
        };
      },
    },
    {
      id: "battery_info",
      title: "Battery Information",
      commands: [
        {
          id: "battery",
          shell: "dumpsys battery",
          parser: (stdout) => parseWithPatterns(stdout, BATTERY_PATTERNS),
        },
      ],
      renderer: (data) => {
        const bat = data["battery"] || {};

        return {
          "AC Powered": String(bat["acPowered"] || ""),
          "USB Powered": String(bat["usbPowered"] || ""),
          "Wireless Powered": String(bat["wirelessPowered"] || ""),
          "Max Charging Current": String(bat["maxChargingCurrent"] || ""),
          "Max Charging Voltage": String(bat["maxChargingVoltage"] || ""),
          "Charge Counter": String(bat["chargeCounter"] || ""),
          Status: String(bat["status"] || ""),
          Health: String(bat["health"] || ""),
          Present: String(bat["present"] || ""),
          Level: bat["level"] && bat["scale"] ? `${bat["level"]}%` : "",
          Voltage: bat["voltage"] ? `${bat["voltage"]} mV` : "",
          Temperature: bat["temperature"]
            ? `${Number(bat["temperature"]) / 10}°C`
            : "",
          Technology: String(bat["technology"] || ""),
          "Current Now": bat["currentNow"] ? `${bat["currentNow"]} mA` : "",
          "LED Charging": String(bat["ledCharging"] || ""),
          "LED Low Battery": String(bat["ledLowBattery"] || ""),
          "Fast Charging": String(bat["fastCharging"] || ""),
          "Super Fast Charging": String(bat["superFastCharging"] || ""),
        };
      },
    },
    {
      id: "netstats_info",
      title: "Network Statistics",
      commands: [
        {
          id: "netstats",
          shell: "dumpsys netstats",
          parser: (stdout) => parseWithPatterns(stdout, NETSTATS_PATTERNS),
        },
      ],
      renderer: (data) => {
        const stats = data["netstats"] || {};

        return {
          "Active Interface": String(stats["activeInterface"] || ""),
          "Interface Type": String(stats["interfaceType"] || ""),
          "Interface SubType": String(stats["interfaceSubType"] || ""),
          Metered: String(stats["metered"] || ""),
          "Default Network": String(stats["defaultNetwork"] || ""),
          "Pending Bytes": String(stats["pendingBytes"] || ""),
        };
      },
    },
    {
      id: "netpolicy_info",
      title: "Network Policy",
      commands: [
        {
          id: "netpolicy",
          shell: "dumpsys netpolicy",
          parser: (stdout) => parseWithPatterns(stdout, NETPOLICY_PATTERNS),
        },
      ],
      renderer: (data) => {
        const policy = data["netpolicy"] || {};

        return {
          "System Ready": String(policy["systemReady"] || ""),
          "Restrict Background": String(policy["restrictBackground"] || ""),
          "Restrict Power": String(policy["restrictPower"] || ""),
          "Device Idle": String(policy["deviceIdle"] || ""),
          "Metered Interfaces": String(policy["meteredIfaces"] || ""),
          Charging: String(policy["charging"] || ""),
        };
      },
    },
    {
      id: "phone_info",
      title: "Phone Information",
      commands: [
        {
          id: "phone",
          shell: "dumpsys phone",
          parser: (stdout) => parseWithPatterns(stdout, PHONE_PATTERNS),
        },
      ],
      renderer: (data) => {
        const phone = data["phone"] || {};

        return {
          "Phone ID": String(phone["phoneId"] || ""),
          "Subscription ID": String(phone["subscriptionId"] || ""),
          "Sort Order": String(phone["sortOrder"] || ""),
          "CS Video Calling": String(phone["csVideoCalling"] || ""),
          "PS Video Calling": String(phone["psVideoCalling"] || ""),
        };
      },
    },
    {
      id: "usb_info",
      title: "USB Information",
      commands: [
        {
          id: "usb",
          shell: "dumpsys usb",
          parser: (stdout) => parseWithPatterns(stdout, USB_PATTERNS),
        },
      ],
      renderer: (data) => {
        const usb = data["usb"] || {};

        return {
          "Boot Completed": String(usb["bootCompleted"] || ""),
          "SIM Count": String(usb["simCount"] || ""),
          "MPSM Support": String(usb["mpsmSupport"] || ""),
          "MPSM Enabled": String(usb["mpsmEnabled"] || ""),
          "SIM Block": String(usb["simBlock"] || ""),
          "MDM Block": String(usb["mdmBlock"] || ""),
          "Dex Mode": String(usb["dexMode"] || ""),
          "Notification Ready": String(usb["notificationReady"] || ""),
          Connected: String(usb["connected"] || ""),
          Configured: String(usb["configured"] || ""),
          "Current Mode": String(usb["currentMode"] || ""),
          "Power Role": String(usb["powerRole"] || ""),
          "Data Role": String(usb["dataRole"] || ""),
          "USB Charging": String(usb["usbCharging"] || ""),
          "Kernel State": String(usb["kernelState"] || ""),
          "Kernel Functions": String(usb["kernelFunctions"] || ""),
          "Current Functions": String(usb["currentFunctions"] || ""),
          "Functions Applied": String(usb["functionsApplied"] || ""),
          "Screen Unlocked Functions": String(
            usb["screenUnlockedFunctions"] || "",
          ),
          "Screen Locked": String(usb["screenLocked"] || ""),
          "Host Connected": String(usb["hostConnected"] || ""),
          "Source Power": String(usb["sourcePower"] || ""),
          "Sink Power": String(usb["sinkPower"] || ""),
          "Hide Notification": String(usb["hideNotification"] || ""),
          "Audio Accessory": String(usb["audioAccessory"] || ""),
          "Num Connects": String(usb["numConnects"] || ""),
          "Port ID": String(usb["portId"] || ""),
          "Supported Modes": String(usb["supportedModes"] || ""),
          "Simulation Active": String(usb["simulationActive"] || ""),
          "Can Change Mode": String(usb["canChangeMode"] || ""),
          "Can Change Power Role": String(usb["canChangePowerRole"] || ""),
          "Can Change Data Role": String(usb["canChangeDataRole"] || ""),
          "Contaminant Status": String(usb["contaminantStatus"] || ""),
          "Connected At (ms)": String(usb["connectedAtMillis"] || ""),
          "ALSA Cards": String(usb["alsaCards"] || ""),
        };
      },
    },
    {
      id: "battery_ext_info",
      title: "Battery Extended",
      commands: [
        {
          id: "battery_ext",
          shell: "dumpsys battery",
          parser: (stdout) => parseWithPatterns(stdout, BATTERY_EXT_PATTERNS),
        },
      ],
      renderer: (data) => {
        const battery = data["battery_ext"] || {};
        return {
          "Misc Event": String(battery["batteryMiscEvent"] || ""),
          "Current Event": String(battery["batteryCurrentEvent"] || ""),
          "Plug Type Summary": String(battery["plugTypeSummary"] || ""),
          "Wireless Fast Charger": String(battery["wirelessFastCharger"] || ""),
          "Saved ASOC": String(battery["savedBatteryAsoc"] || ""),
          "Saved Max Temp": String(battery["savedBatteryMaxTemp"] || ""),
          "Saved Max Current": String(battery["savedBatteryMaxCurrent"] || ""),
          "Saved Usage": String(battery["savedBatteryUsage"] || ""),
        };
      },
    },
    {
      id: "display_info",
      title: "Display Information",
      commands: [
        {
          id: "display",
          shell: "dumpsys display",
          parser: (stdout) => parseWithPatterns(stdout, DISPLAY_PATTERNS),
        },
      ],
      renderer: (data) => {
        const display = data["display"] || {};
        return {
          "Display State": String(display["displayState"] || ""),
          "Next Display ID": String(display["nextDisplayId"] || ""),
          "Stable Display Size": String(display["stableDisplaySize"] || ""),
          "WiFi Display Scan Count": String(
            display["wifiDisplayScanCount"] || "",
          ),
          "WiFi Display Feature State": String(
            display["wifiDisplayFeatureState"] || "",
          ),
          "WiFi Display Scan State": String(
            display["wifiDisplayScanState"] || "",
          ),
          "WiFi P2P Enabled": String(display["wifiP2pEnabled"] || ""),
          "WFD Enabled": String(display["wfdEnabled"] || ""),
        };
      },
    },
    {
      id: "power_info",
      title: "Power Information",
      commands: [
        {
          id: "power",
          shell: "dumpsys power",
          parser: (stdout) => parseWithPatterns(stdout, POWER_PATTERNS),
        },
      ],
      renderer: (data) => {
        const power = data["power"] || {};
        return {
          Wakefulness: String(power["wakefulness"] || ""),
          "Is Powered": String(power["isPowered"] || ""),
          "Plug Type": String(power["plugType"] || ""),
          "Battery Level": String(power["batteryLevel"] || ""),
          "Stay On": String(power["stayOn"] || ""),
          "Boot Completed": String(power["bootCompleted"] || ""),
          "System Ready": String(power["systemReady"] || ""),
          "Battery Level Low": String(power["batteryLevelLow"] || ""),
          "Light Device Idle Mode": String(power["lightDeviceIdleMode"] || ""),
          "Device Idle Mode": String(power["deviceIdleMode"] || ""),
          "Display Ready": String(power["displayReady"] || ""),
        };
      },
    },
    {
      id: "alarm_info",
      title: "Alarm Information",
      commands: [
        {
          id: "alarm",
          shell: "dumpsys alarm",
          parser: (stdout) => parseWithPatterns(stdout, ALARM_PATTERNS),
        },
      ],
      renderer: (data) => {
        const alarm = data["alarm"] || {};
        return {
          "Min Futurity": String(alarm["minFuturity"] || ""),
          "Min Interval": String(alarm["minInterval"] || ""),
          "Max Interval": String(alarm["maxInterval"] || ""),
          "Max Alarms Per UID": String(alarm["maxAlarmsPerUid"] || ""),
          "App Standby Enabled": String(alarm["appStandbyEnabled"] || ""),
          "Force App Standby": String(alarm["forceAppStandby"] || ""),
          "Plugged In": String(alarm["pluggedIn"] || ""),
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
