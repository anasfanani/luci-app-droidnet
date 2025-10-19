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
  label: string;
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
      result[pattern.label] = pattern.transform
        ? pattern.transform(match)
        : match[1];
    }
  }

  return result;
}

// Generic renderer
function renderFromPatterns(
  data: ParsedData,
  patterns: ParsePattern[],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pattern of patterns) {
    const value = data[pattern.label];
    result[pattern.label] = Array.isArray(value)
      ? value.join(", ")
      : String(value || "");
  }

  return result;
}

// Connectivity patterns - comprehensive (50+ fields)
const CONNECTIVITY_PATTERNS: ParsePattern[] = [
  { label: "Network ID", regex: /network\{(\d+)\}/ },
  { label: "Net Handle", regex: /nethandle\{(\d+)\}/ },
  {
    label: "Network Type",
    regex: /type:\s*(\w+)\[(\w+)\]/,
    transform: (m) => `${m[1] || ""} (${m[2] || ""})`,
  },
  {
    label: "State",
    regex: /state:\s*(\w+)\/(\w+)/,
    transform: (m) => m[1] || "",
  },
  { label: "Reason", regex: /reason:\s*\(([^)]+)\)/ },
  { label: "Extra", regex: /extra:\s*(\w+)/ },
  { label: "Failover", regex: /failover:\s*(\w+)/ },
  { label: "Available", regex: /available:\s*(\w+)/ },
  { label: "Roaming", regex: /roaming:\s*(\w+)/ },
  { label: "Interface", regex: /InterfaceName:\s*(\w+)/ },
  {
    label: "IP Address",
    regex: /LinkAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) => (m[1] || "").trim(),
  },
  {
    label: "DNS Servers",
    regex: /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
    transform: (m) =>
      (m[1] || "").split(",").map((s: string) => s.trim().replace(/^\//, "")),
  },
  { label: "Domains", regex: /Domains:\s*(\S+)/ },
  {
    label: "Gateway",
    regex: /Routes:\s*\[([^\]]+)\]/,
    transform: (m) => (m[1] || "").trim(),
  },
  { label: "MTU", regex: /MTU:\s*(\d+)/ },
  { label: "TCP Buffers", regex: /TcpBufferSizes:\s*([^\s]+)/ },
  {
    label: "Capabilities",
    regex: /Capabilities:\s*([^\s]+)/,
    transform: (m) => (m[1] || "").split("&"),
  },
  { label: "Transports", regex: /Transports:\s*(\w+)/ },
  {
    label: "Upload Bandwidth",
    regex: /LinkUpBandwidth>=(\d+)Kbps/,
    transform: (m) => `${m[1]} Kbps`,
  },
  {
    label: "Download Bandwidth",
    regex: /LinkDnBandwidth>=(\d+)Kbps/,
    transform: (m) => `${m[1]} Kbps`,
  },
  { label: "Specifier", regex: /Specifier:\s*<(\d+)>/ },
  { label: "Score", regex: /Score\{(\d+)\}/ },
  { label: "Ever Validated", regex: /everValidated\{(\w+)\}/ },
  { label: "Last Validated", regex: /lastValidated\{(\w+)\}/ },
  { label: "Created", regex: /created\{(\w+)\}/ },
  { label: "Lingering", regex: /lingering\{(\w+)\}/ },
  { label: "Explicitly Selected", regex: /explicitlySelected\{(\w+)\}/ },
  { label: "Accept Unvalidated", regex: /acceptUnvalidated\{(\w+)\}/ },
  { label: "Ever Captive Portal", regex: /everCaptivePortalDetected\{(\w+)\}/ },
  { label: "Last Captive Portal", regex: /lastCaptivePortalDetected\{(\w+)\}/ },
  {
    label: "Captive Portal Pending",
    regex: /captivePortalValidationPending\{(\w+)\}/,
  },
  { label: "Partial Connectivity", regex: /partialConnectivity\{(\w+)\}/ },
  { label: "Accept Partial", regex: /acceptPartialConnectivity\{(\w+)\}/ },
  { label: "CLAT State", regex: /mState:\s*(\w+)/ },
  { label: "Restrict Background", regex: /Restrict background:\s*(\w+)/ },
  { label: "Tether Sub ID", regex: /subId:\s*(\d+)/ },
  { label: "Tetherable USB", regex: /tetherableUsbRegexs:\s*\[([^\]]+)\]/ },
  { label: "Tetherable WiFi", regex: /tetherableWifiRegexs:\s*\[([^\]]+)\]/ },
  {
    label: "Tetherable Bluetooth",
    regex: /tetherableBluetoothRegexs:\s*\[([^\]]+)\]/,
  },
  {
    label: "Tetherable Ethernet",
    regex: /tetherableEthernetRegexs:\s*\[([^\]]+)\]/,
  },
  { label: "DUN Required", regex: /isDunRequired:\s*(\w+)/ },
  { label: "Upstream Auto", regex: /chooseUpstreamAutomatically:\s*(\w+)/ },
  { label: "Default DNS", regex: /defaultIPv4DNS:\s*\[([^\]]+)\]/ },
  {
    label: "Upstream Interface",
    regex: /Current upstream interface\(s\):\s*\[([^\]]+)\]/,
  },
  { label: "Active Default Network", regex: /Active default network:\s*(\d+)/ },
  {
    label: "Restrict Background Status",
    regex: /Restrict background:\s*(\w+)/,
  },
];

// Telephony patterns - comprehensive (60+ fields)
const TELEPHONY_PATTERNS: ParsePattern[] = [
  {
    label: "Voice Registration",
    regex: /mVoiceRegState=(\d+)\(([^)]+)\)/,
    transform: (m) => m[2] || "",
  },
  {
    label: "Data Registration",
    regex: /mDataRegState=(\d+)\(([^)]+)\)/,
    transform: (m) => m[2] || "",
  },
  { label: "Channel Number", regex: /mChannelNumber=(\d+)/ },
  { label: "Duplex Mode", regex: /duplexMode\(\)=(\d+)/ },
  { label: "Manual Selection", regex: /isManualNetworkSelection=(\w+)/ },
  {
    label: "Voice Radio Tech",
    regex: /getRilVoiceRadioTechnology[=:](\d+)\((\w+)\)/,
    transform: (m) => m[2] || "",
  },
  {
    label: "Data Radio Tech",
    regex: /getRilDataRadioTechnology[=:](\d+)\((\w+)\)/,
    transform: (m) => m[2] || "",
  },
  { label: "CSS Indicator", regex: /mCssIndicator=(\w+)/ },
  { label: "CDMA Roaming", regex: /mCdmaRoamingIndicator=(-?\d+)/ },
  { label: "Voice Reg Type", regex: /VoiceRegType=(\d+)/ },
  { label: "IMS Voice Avail", regex: /ImsVoiceAvail=(\d+)/ },
  { label: "SNAP", regex: /Snap=(\d+)/ },
  { label: "Mobile Voice", regex: /MobileVoice=(\w+)/ },
  { label: "Mobile Voice RAT", regex: /MobileVoiceRat=(\w+)/ },
  { label: "Mobile Data", regex: /MobileData=(\w+)/ },
  { label: "Mobile Data Roaming", regex: /MobileDataRoamingType=(\w+)/ },
  { label: "Mobile Data RAT", regex: /MobileDataRat=(\w+)/ },
  { label: "PS Only", regex: /PsOnly=(\w+)/ },
  { label: "Femtocell", regex: /FemtocellInd=(\d+)/ },
  { label: "EN-DC Status", regex: /EndcStatus=(\d+)/ },
  { label: "Restrict DC-NR", regex: /RestrictDcnr=(\d+)/ },
  { label: "NR Bearer Status", regex: /NrBearerStatus=(\d+)/ },
  { label: "5G Status", regex: /5gStatus=(\d+)/ },
  { label: "RRC State", regex: /RRCState=(-?\d+)/ },
  { label: "NR Icon Type", regex: /NrIconType=(\d+)/ },
  { label: "Emergency Only", regex: /mIsEmergencyOnly=(\w+)/ },
  { label: "Carrier Aggregation", regex: /isUsingCarrierAggregation=(\w+)/ },
  { label: "LTE EARFCN RSRP Boost", regex: /mLteEarfcnRsrpBoost=(\d+)/ },
  { label: "NR Frequency Range", regex: /mNrFrequencyRange=(-?\d+)/ },
  { label: "IWLAN Preferred", regex: /mIsIwlanPreferred=(\w+)/ },
  { label: "Registration State", regex: /registrationState=(\w+)/ },
  { label: "Roaming Type", regex: /roamingType=(\w+)/ },
  { label: "Access Network Tech", regex: /accessNetworkTechnology=(\w+)/ },
  { label: "Reject Cause", regex: /rejectCause=(\d+)/ },
  { label: "Emergency Enabled", regex: /emergencyEnabled=(\w+)/ },
  { label: "Available Services", regex: /availableServices=\[([^\]]*)\]/ },
  { label: "Cell ID", regex: /mCi=(\d+)/ },
  { label: "Physical Cell ID", regex: /mPci=(\d+)/ },
  { label: "Tracking Area Code", regex: /mTac=(\d+)/ },
  { label: "EARFCN", regex: /mEarfcn=(\d+)/ },
  { label: "Bandwidth", regex: /mBandwidth=(\d+)/ },
  { label: "MCC", regex: /mMcc=(\d+)/ },
  { label: "MNC", regex: /mMnc=(\d+)/ },
  { label: "Carrier", regex: /mAlphaLong=(\w+)/ },
  { label: "Carrier Short", regex: /mAlphaShort=(\w+)/ },
  { label: "CSS Supported", regex: /mCssSupported=(\w+)/ },
  { label: "Roaming Indicator", regex: /mRoamingIndicator=(\d+)/ },
  { label: "System In PRL", regex: /mSystemIsInPrl=(\d+)/ },
  { label: "Max Data Calls", regex: /maxDataCalls\s*=\s*(\d+)/ },
  { label: "DC-NR Restricted", regex: /isDcNrRestricted\s*=\s*(\w+)/ },
  { label: "NR Available", regex: /isNrAvailable\s*=\s*(\w+)/ },
  { label: "EN-DC Available", regex: /isEnDcAvailable\s*=\s*(\w+)/ },
  { label: "VoPS Support", regex: /mVopsSupport\s*=\s*(\d+)/ },
  { label: "EMC Bearer Support", regex: /mEmcBearerSupport\s*=\s*(\d+)/ },
  { label: "Signal RSSI", regex: /rssi=(-?\d+)/ },
  { label: "Signal RSRP", regex: /rsrp=(-?\d+)/ },
  { label: "Signal RSRQ", regex: /rsrq=(-?\d+)/ },
  { label: "Signal RSSNR", regex: /rssnr=(-?\d+)/ },
  { label: "Signal CQI", regex: /cqi=(\d+)/ },
  { label: "Signal TA", regex: /ta=(\d+)/ },
  { label: "Signal Level", regex: /level=(\d+)/ },
  { label: "Signal BER", regex: /ber=(\d+)/ },
  { label: "Call State", regex: /mCallState=(\d+)/ },
  { label: "Data State", regex: /mDataConnectionState=(\d+)/ },
  { label: "Data Activity", regex: /mDataActivity=(\d+)/ },
  { label: "Message Waiting", regex: /mMessageWaiting=(\w+)/ },
  { label: "Call Forwarding", regex: /mCallForwarding=(\w+)/ },
  { label: "Voice Activation", regex: /mVoiceActivationState=\s*(\d+)/ },
  { label: "Data Activation", regex: /mDataActivationState=\s*(\d+)/ },
  { label: "User Mobile Data", regex: /mUserMobileDataState=\s*(\w+)/ },
  { label: "SRVCC State", regex: /mSrvccState=(-?\d+)/ },
  { label: "OTASP Mode", regex: /mOtaspMode=(\d+)/ },
  { label: "Default Sub ID", regex: /mDefaultSubId=(\d+)/ },
  { label: "Default Phone ID", regex: /mDefaultPhoneId=(\d+)/ },
  { label: "Active Data Sub ID", regex: /mActiveDataSubId=(\d+)/ },
  { label: "Radio Power State", regex: /mRadioPowerState=(\d+)/ },
  { label: "Ringing Call State", regex: /mRingingCallState=(\d+)/ },
  { label: "Foreground Call State", regex: /mForegroundCallState=(\d+)/ },
  { label: "Background Call State", regex: /mBackgroundCallState=(\d+)/ },
  {
    label: "Carrier Network Change",
    regex: /mCarrierNetworkChangeState=(\w+)/,
  },
  { label: "Max Active Data", regex: /maxActiveData=(\d+)/ },
  { label: "Max 5G", regex: /max5G=(\d+)/ },
];

// Data-driven architecture
interface NetworkConfig {
  sections: NetworkSection[];
}

interface NetworkSection {
  id: string;
  title: string;
  command: string;
  patterns: ParsePattern[];
}

// WiFi patterns
const WIFI_PATTERNS: ParsePattern[] = [
  { label: "WiFi Status", regex: /Wi-Fi is (\w+)/ },
  { label: "Verbose Logging", regex: /Verbose logging is (\w+)/ },
  { label: "Stay Awake", regex: /Stay-awake conditions:\s*(\d+)/ },
  { label: "Idle Mode", regex: /mInIdleMode\s+(\w+)/ },
  { label: "Scan Pending", regex: /mScanPending\s+(\w+)/ },
  { label: "Vendor", regex: /Wi-Fi vendor:\s*([^\n]+)/ },
  { label: "Supported Feature", regex: /Supported feature:\s*(\d+)/ },
];

// Battery patterns
const BATTERY_PATTERNS: ParsePattern[] = [
  { label: "AC Powered", regex: /AC powered:\s*(\w+)/ },
  { label: "USB Powered", regex: /USB powered:\s*(\w+)/ },
  { label: "Wireless Powered", regex: /Wireless powered:\s*(\w+)/ },
  { label: "Max Charging Current", regex: /Max charging current:\s*(\d+)/ },
  { label: "Max Charging Voltage", regex: /Max charging voltage:\s*(\d+)/ },
  { label: "Charge Counter", regex: /Charge counter:\s*(\d+)/ },
  { label: "Status", regex: /status:\s*(\d+)/ },
  { label: "Health", regex: /health:\s*(\d+)/ },
  { label: "Present", regex: /present:\s*(\w+)/ },
  { label: "Level", regex: /level:\s*(\d+)/ },
  { label: "Scale", regex: /scale:\s*(\d+)/ },
  { label: "Voltage", regex: /voltage:\s*(\d+)/ },
  { label: "Temperature", regex: /temperature:\s*(\d+)/ },
  { label: "Technology", regex: /technology:\s*(.+)/ },
  { label: "Current Now", regex: /current now:\s*(-?\d+)/ },
  { label: "LED Charging", regex: /LED Charging:\s*(\w+)/ },
  { label: "LED Low Battery", regex: /LED Low Battery:\s*(\w+)/ },
  { label: "Fast Charging", regex: /Adaptive Fast Charging Settings:\s*(\w+)/ },
  {
    label: "Super Fast Charging",
    regex: /Super Fast Charging Settings:\s*(\w+)/,
  },
];

// NetStats patterns
const NETSTATS_PATTERNS: ParsePattern[] = [
  { label: "Active Interface", regex: /Active interfaces:\s*\n\s*iface=(\w+)/ },
  { label: "Interface Type", regex: /type=(\w+)/ },
  { label: "Interface SubType", regex: /subType=(\w+)/ },
  { label: "Metered", regex: /metered=(\w+)/ },
  { label: "Default Network", regex: /defaultNetwork=(\w+)/ },
  { label: "Pending Bytes", regex: /Pending bytes:\s*(\d+)/ },
];

// NetPolicy patterns
const NETPOLICY_PATTERNS: ParsePattern[] = [
  { label: "System Ready", regex: /System ready:\s*(\w+)/ },
  { label: "Restrict Background", regex: /Restrict background:\s*(\w+)/ },
  { label: "Restrict Power", regex: /Restrict power:\s*(\w+)/ },
  { label: "Device Idle", regex: /Device idle:\s*(\w+)/ },
  { label: "Metered Interfaces", regex: /Metered ifaces:\s*\{([^}]+)\}/ },
  { label: "Charging", regex: /Charging:\s*(\w+)/ },
];

// Phone patterns
const PHONE_PATTERNS: ParsePattern[] = [
  { label: "Phone ID", regex: /PHONE_ID=(\d+)/ },
  { label: "Subscription ID", regex: /SUBSCRIPTION_ID=(\d+)/ },
  { label: "Sort Order", regex: /SORT_ORDER=(\d+)/ },
  { label: "CS Video Calling", regex: /CS_VIDEO_CALLING=(\w+)/ },
  { label: "PS Video Calling", regex: /PS_VIDEO_CALLING=(\w+)/ },
];

// USB patterns
const USB_PATTERNS: ParsePattern[] = [
  { label: "Boot Completed", regex: /mBootCompleted:(\w+)/ },
  { label: "SIM Count", regex: /All SIM Count:(\d+)/ },
  { label: "MPSM Support", regex: /SUPPORT MPSM\s*:(\w+)/ },
  { label: "MPSM Enabled", regex: /MPSM ON\/OFF\s*:(\w+)/ },
  { label: "SIM Block", regex: /SIM BLOCK ON\/OFF\s*:(\w+)/ },
  { label: "MDM Block", regex: /MDM BLOCK ON\/OFF\s*:(\w+)/ },
  { label: "Dex Mode", regex: /DexModeObserver state:(\w+)/ },
  {
    label: "Notification Ready",
    regex: /Notification\s*:\s*\n\s*ready\s*:\s*(\w+)/,
  },
  { label: "Connected", regex: /connected=(\w+)/ },
  { label: "Configured", regex: /configured=(\w+)/ },
  { label: "Current Mode", regex: /current_mode=(\w+)/ },
  { label: "Power Role", regex: /power_role=(\w+)/ },
  { label: "Data Role", regex: /data_role=(\w+)/ },
  { label: "USB Charging", regex: /usb_charging=(\w+)/ },
  { label: "Kernel State", regex: /kernel_state=(\w+)/ },
  { label: "Kernel Functions", regex: /kernel_function_list=([^\s]+)/ },
  {
    label: "Current Functions",
    regex: /current_functions=\[\s*([^\]]+)\]/,
    transform: (m) => (m[1] || "").trim().replace(/\s+/g, ", "),
  },
  { label: "Functions Applied", regex: /current_functions_applied=(\w+)/ },
  {
    label: "Screen Unlocked Functions",
    regex: /screen_unlocked_functions=(\w+)/,
  },
  { label: "Screen Locked", regex: /screen_locked=(\w+)/ },
  { label: "Host Connected", regex: /host_connected=(\w+)/ },
  { label: "Source Power", regex: /source_power=(\w+)/ },
  { label: "Sink Power", regex: /sink_power=(\w+)/ },
  { label: "Hide Notification", regex: /hide_usb_notification=(\w+)/ },
  { label: "Audio Accessory", regex: /audio_accessory_connected=(\w+)/ },
  { label: "Num Connects", regex: /num_connects=(\d+)/ },
  { label: "Port ID", regex: /id=(port\d+)/ },
  { label: "Supported Modes", regex: /supported_modes=(\w+)/ },
  { label: "Simulation Active", regex: /is_simulation_active=(\w+)/ },
  { label: "Can Change Mode", regex: /can_change_mode=(\w+)/ },
  { label: "Can Change Power Role", regex: /can_change_power_role=(\w+)/ },
  { label: "Can Change Data Role", regex: /can_change_data_role=(\w+)/ },
  {
    label: "Contaminant Status",
    regex: /contaminant_presence_status=([^\s]+)/,
  },
  { label: "Connected At (ms)", regex: /connected_at_millis=(\d+)/ },
  { label: "ALSA Cards", regex: /cards_parser=(-?\d+)/ },
];

// Battery Extended patterns
const BATTERY_EXT_PATTERNS: ParsePattern[] = [
  { label: "Misc Event", regex: /batteryMiscEvent:\s*(\d+)/ },
  { label: "Current Event", regex: /batteryCurrentEvent:\s*(\d+)/ },
  { label: "Plug Type Summary", regex: /mSecPlugTypeSummary:\s*(\d+)/ },
  {
    label: "Wireless Fast Charger",
    regex: /mWirelessFastChargingSettingsEnable:\s*(\w+)/,
  },
  { label: "Saved ASOC", regex: /mSavedBatteryAsoc:\s*(\d+)/ },
  { label: "Saved Max Temp", regex: /mSavedBatteryMaxTemp:\s*(\d+)/ },
  { label: "Saved Max Current", regex: /mSavedBatteryMaxCurrent:\s*(\d+)/ },
  { label: "Saved Usage", regex: /mSavedBatteryUsage:\s*(\d+)/ },
];

// Display patterns
const DISPLAY_PATTERNS: ParsePattern[] = [
  { label: "Display State", regex: /mGlobalDisplayState=(\w+)/ },
  { label: "Next Display ID", regex: /mNextNonDefaultDisplayId=(\d+)/ },
  {
    label: "Stable Display Size",
    regex: /mStableDisplaySize=Point\((\d+),\s*(\d+)\)/,
    transform: (m) => `${m[1]}x${m[2]}`,
  },
  {
    label: "WiFi Display Scan Count",
    regex: /mWifiDisplayScanRequestCount=(\d+)/,
  },
  { label: "WiFi Display Feature State", regex: /featureState=(\d+)/ },
  { label: "WiFi Display Scan State", regex: /scanState=(\d+)/ },
  { label: "WiFi P2P Enabled", regex: /mWifiP2pEnabled=(\w+)/ },
  { label: "WFD Enabled", regex: /mWfdEnabled=(\w+)/ },
];

// Power patterns
const POWER_PATTERNS: ParsePattern[] = [
  { label: "Wakefulness", regex: /mWakefulness=(\w+)/ },
  { label: "Is Powered", regex: /mIsPowered=(\w+)/ },
  { label: "Plug Type", regex: /mPlugType=(\d+)/ },
  { label: "Battery Level", regex: /mBatteryLevel=(\d+)/ },
  { label: "Stay On", regex: /mStayOn=(\w+)/ },
  { label: "Boot Completed", regex: /mBootCompleted=(\w+)/ },
  { label: "System Ready", regex: /mSystemReady=(\w+)/ },
  { label: "Battery Level Low", regex: /mBatteryLevelLow=(\w+)/ },
  { label: "Light Device Idle Mode", regex: /mLightDeviceIdleMode=(\w+)/ },
  { label: "Device Idle Mode", regex: /mDeviceIdleMode=(\w+)/ },
  { label: "Display Ready", regex: /mDisplayReady=(\w+)/ },
];

// Alarm patterns
const ALARM_PATTERNS: ParsePattern[] = [
  { label: "Min Futurity", regex: /min_futurity=\+([^\n]+)/ },
  { label: "Min Interval", regex: /min_interval=\+([^\n]+)/ },
  { label: "Max Interval", regex: /max_interval=\+([^\n]+)/ },
  { label: "Max Alarms Per UID", regex: /max_alarms_per_uid=(\d+)/ },
  { label: "App Standby Enabled", regex: /app_standby_quotas_enabled=(\w+)/ },
  { label: "Force App Standby", regex: /Force all apps standby:\s*(\w+)/ },
  { label: "Plugged In", regex: /Plugged In:\s*(\w+)/ },
];

const NETWORK_CONFIG: NetworkConfig = {
  sections: [
    {
      id: "network_info",
      title: "Network Information",
      command: "dumpsys connectivity",
      patterns: CONNECTIVITY_PATTERNS,
    },
    {
      id: "cellular_info",
      title: "Cellular Information",
      command: "dumpsys telephony.registry",
      patterns: TELEPHONY_PATTERNS,
    },
    {
      id: "wifi_info",
      title: "WiFi Information",
      command: "dumpsys wifi",
      patterns: WIFI_PATTERNS,
    },
    {
      id: "battery_info",
      title: "Battery Information",
      command: "dumpsys battery",
      patterns: BATTERY_PATTERNS,
    },
    {
      id: "netstats_info",
      title: "Network Statistics",
      command: "dumpsys netstats",
      patterns: NETSTATS_PATTERNS,
    },
    {
      id: "netpolicy_info",
      title: "Network Policy",
      command: "dumpsys netpolicy",
      patterns: NETPOLICY_PATTERNS,
    },
    {
      id: "phone_info",
      title: "Phone Information",
      command: "dumpsys phone",
      patterns: PHONE_PATTERNS,
    },
    {
      id: "usb_info",
      title: "USB Information",
      command: "dumpsys usb",
      patterns: USB_PATTERNS,
    },
    {
      id: "battery_ext_info",
      title: "Battery Extended",
      command: "dumpsys battery",
      patterns: BATTERY_EXT_PATTERNS,
    },
    {
      id: "display_info",
      title: "Display Information",
      command: "dumpsys display",
      patterns: DISPLAY_PATTERNS,
    },
    {
      id: "power_info",
      title: "Power Information",
      command: "dumpsys power",
      patterns: POWER_PATTERNS,
    },
    {
      id: "alarm_info",
      title: "Alarm Information",
      command: "dumpsys alarm",
      patterns: ALARM_PATTERNS,
    },
  ],
};

// Generic engine
async function loadDataDriven(): Promise<Record<string, ParsedData>> {
  const sectionData: Record<string, ParsedData> = {};

  for (const section of NETWORK_CONFIG.sections) {
    const result = await DroidNet.exec(section.command.split(" "));
    sectionData[section.id] = parseWithPatterns(
      result.stdout || "",
      section.patterns,
    );
  }

  return sectionData;
}

function renderDataDriven(data: Record<string, ParsedData>): HTMLElement[] {
  const results = NETWORK_CONFIG.sections
    .map((section) => {
      const sectionData = renderFromPatterns(
        data[section.id] || {},
        section.patterns,
      );
      const rows = Object.entries(sectionData).map(([label, value]) => ({
        label,
        value,
      }));

      return rows.length > 0
        ? [
            UIRenderer.renderTitle(section.title),
            UIRenderer.renderTable(rows, { col: 6 }),
          ]
        : null;
    })
    .filter(Boolean);

  return results.flat() as HTMLElement[];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend(
  DroidNet.createView({
    load: loadDataDriven,
    render: (data: Record<string, ParsedData> & DeviceStatus) => [
      renderDataDriven(data),
    ],
  }),
);
