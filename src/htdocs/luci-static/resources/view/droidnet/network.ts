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
  regex: RegExp;
  transform?: (match: RegExpMatchArray) => string | number | string[];
}

interface Section {
  title: string;
  command: string;
  patterns: Record<string, ParsePattern>;
}

type ParsedData = Record<string, string | number | string[]>;

function parseWithPatterns(
  stdout: string,
  patterns: Record<string, ParsePattern>,
): ParsedData {
  const result: ParsedData = {};

  for (const [label, pattern] of Object.entries(patterns)) {
    const match = stdout.match(pattern.regex);
    if (match && match[1]) {
      result[label] = pattern.transform ? pattern.transform(match) : match[1];
    }
  }

  return result;
}

// Generic renderer
function renderFromPatterns(data: ParsedData): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [label, value] of Object.entries(data)) {
    result[label] = Array.isArray(value)
      ? value.join(", ")
      : String(value || "");
  }

  return result;
}

const NETWORK_INFO: Section = {
  title: "Network Information",
  command: "dumpsys connectivity",
  patterns: {
    "Network ID": { regex: /network\{(\d+)\}/ },
    "Net Handle": { regex: /nethandle\{(\d+)\}/ },
    "Network Type": {
      regex: /type:\s*(\w+)\[(\w+)\]/,
      transform: (m: RegExpMatchArray) => `${m[1] || ""} (${m[2] || ""})`,
    },
    State: {
      regex: /state:\s*(\w+)\/(\w+)/,
      transform: (m: RegExpMatchArray) => m[1] || "",
    },
    Reason: { regex: /reason:\s*\(([^)]+)\)/ },
    Extra: { regex: /extra:\s*(\w+)/ },
    Failover: { regex: /failover:\s*(\w+)/ },
    Available: { regex: /available:\s*(\w+)/ },
    Roaming: { regex: /roaming:\s*(\w+)/ },
    Interface: { regex: /InterfaceName:\s*(\w+)/ },
    "IP Address": {
      regex: /LinkAddresses:\s*\[\s*([^\]]+)\s*\]/,
      transform: (m: RegExpMatchArray) => (m[1] || "").trim(),
    },
    "DNS Servers": {
      regex: /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
      transform: (m: RegExpMatchArray) =>
        (m[1] || "").split(",").map((s: string) => s.trim().replace(/^\//, "")),
    },
    Domains: { regex: /Domains:\s*(\S+)/ },
    Gateway: {
      regex: /Routes:\s*\[([^\]]+)\]/,
      transform: (m: RegExpMatchArray) => (m[1] || "").trim(),
    },
    MTU: { regex: /MTU:\s*(\d+)/ },
    "TCP Buffers": { regex: /TcpBufferSizes:\s*([^\s]+)/ },
    Capabilities: {
      regex: /Capabilities:\s*([^\s]+)/,
      transform: (m: RegExpMatchArray) => (m[1] || "").split("&"),
    },
    Transports: { regex: /Transports:\s*(\w+)/ },
    "Upload Bandwidth": {
      regex: /LinkUpBandwidth>=(\d+)Kbps/,
      transform: (m: RegExpMatchArray) => `${m[1]} Kbps`,
    },
    "Download Bandwidth": {
      regex: /LinkDnBandwidth>=(\d+)Kbps/,
      transform: (m: RegExpMatchArray) => `${m[1]} Kbps`,
    },
    Specifier: { regex: /Specifier:\s*<(\d+)>/ },
    Score: { regex: /Score\{(\d+)\}/ },
    "Ever Validated": { regex: /everValidated\{(\w+)\}/ },
    "Last Validated": { regex: /lastValidated\{(\w+)\}/ },
    Created: { regex: /created\{(\w+)\}/ },
    Lingering: { regex: /lingering\{(\w+)\}/ },
    "Explicitly Selected": { regex: /explicitlySelected\{(\w+)\}/ },
    "Accept Unvalidated": { regex: /acceptUnvalidated\{(\w+)\}/ },
    "Ever Captive Portal": { regex: /everCaptivePortalDetected\{(\w+)\}/ },
    "Last Captive Portal": { regex: /lastCaptivePortalDetected\{(\w+)\}/ },
    "Captive Portal Pending": {
      regex: /captivePortalValidationPending\{(\w+)\}/,
    },
    "Partial Connectivity": { regex: /partialConnectivity\{(\w+)\}/ },
    "Accept Partial": { regex: /acceptPartialConnectivity\{(\w+)\}/ },
    "CLAT State": { regex: /mState:\s*(\w+)/ },
    "Restrict Background": { regex: /Restrict background:\s*(\w+)/ },
    "Tether Sub ID": { regex: /subId:\s*(\d+)/ },
    "Tetherable USB": { regex: /tetherableUsbRegexs:\s*\[([^\]]+)\]/ },
    "Tetherable WiFi": { regex: /tetherableWifiRegexs:\s*\[([^\]]+)\]/ },
    "Tetherable Bluetooth": {
      regex: /tetherableBluetoothRegexs:\s*\[([^\]]+)\]/,
    },
    "Tetherable Ethernet": {
      regex: /tetherableEthernetRegexs:\s*\[([^\]]+)\]/,
    },
    "DUN Required": { regex: /isDunRequired:\s*(\w+)/ },
    "Upstream Auto": { regex: /chooseUpstreamAutomatically:\s*(\w+)/ },
    "Default DNS": { regex: /defaultIPv4DNS:\s*\[([^\]]+)\]/ },
    "Upstream Interface": {
      regex: /Current upstream interface\(s\):\s*\[([^\]]+)\]/,
    },
    "Active Default Network": { regex: /Active default network:\s*(\d+)/ },
    "Restrict Background Status": { regex: /Restrict background:\s*(\w+)/ },
  },
};

const CELLULAR_INFO: Section = {
  title: "Cellular Information",
  command: "dumpsys telephony.registry",
  patterns: {
    "Voice Registration": {
      regex: /mVoiceRegState=(\d+)\(([^)]+)\)/,
      transform: (m: RegExpMatchArray) => m[2] || "",
    },
    "Data Registration": {
      regex: /mDataRegState=(\d+)\(([^)]+)\)/,
      transform: (m: RegExpMatchArray) => m[2] || "",
    },
    "Channel Number": { regex: /mChannelNumber=(\d+)/ },
    "Duplex Mode": { regex: /duplexMode\(\)=(\d+)/ },
    "Manual Selection": { regex: /isManualNetworkSelection=(\w+)/ },
    "Voice Radio Tech": {
      regex: /getRilVoiceRadioTechnology[=:](\d+)\((\w+)\)/,
      transform: (m: RegExpMatchArray) => m[2] || "",
    },
    "Data Radio Tech": {
      regex: /getRilDataRadioTechnology[=:](\d+)\((\w+)\)/,
      transform: (m: RegExpMatchArray) => m[2] || "",
    },
    "CSS Indicator": { regex: /mCssIndicator=(\w+)/ },
    "CDMA Roaming": { regex: /mCdmaRoamingIndicator=(-?\d+)/ },
    "Voice Reg Type": { regex: /VoiceRegType=(\d+)/ },
    "IMS Voice Avail": { regex: /ImsVoiceAvail=(\d+)/ },
    SNAP: { regex: /Snap=(\d+)/ },
    "Mobile Voice": { regex: /MobileVoice=(\w+)/ },
    "Mobile Voice RAT": { regex: /MobileVoiceRat=(\w+)/ },
    "Mobile Data": { regex: /MobileData=(\w+)/ },
    "Mobile Data Roaming": { regex: /MobileDataRoamingType=(\w+)/ },
    "Mobile Data RAT": { regex: /MobileDataRat=(\w+)/ },
    "PS Only": { regex: /PsOnly=(\w+)/ },
    Femtocell: { regex: /FemtocellInd=(\d+)/ },
    "EN-DC Status": { regex: /EndcStatus=(\d+)/ },
    "Restrict DC-NR": { regex: /RestrictDcnr=(\d+)/ },
    "NR Bearer Status": { regex: /NrBearerStatus=(\d+)/ },
    "5G Status": { regex: /5gStatus=(\d+)/ },
    "RRC State": { regex: /RRCState=(-?\d+)/ },
    "NR Icon Type": { regex: /NrIconType=(\d+)/ },
    "Emergency Only": { regex: /mIsEmergencyOnly=(\w+)/ },
    "Carrier Aggregation": { regex: /isUsingCarrierAggregation=(\w+)/ },
    "LTE EARFCN RSRP Boost": { regex: /mLteEarfcnRsrpBoost=(\d+)/ },
    "NR Frequency Range": { regex: /mNrFrequencyRange=(-?\d+)/ },
    "IWLAN Preferred": { regex: /mIsIwlanPreferred=(\w+)/ },
    "Registration State": { regex: /registrationState=(\w+)/ },
    "Roaming Type": { regex: /roamingType=(\w+)/ },
    "Access Network Tech": { regex: /accessNetworkTechnology=(\w+)/ },
    "Reject Cause": { regex: /rejectCause=(\d+)/ },
    "Emergency Enabled": { regex: /emergencyEnabled=(\w+)/ },
    "Available Services": { regex: /availableServices=\[([^\]]*)\]/ },
    "Cell ID": { regex: /mCi=(\d+)/ },
    "Physical Cell ID": { regex: /mPci=(\d+)/ },
    "Tracking Area Code": { regex: /mTac=(\d+)/ },
    EARFCN: { regex: /mEarfcn=(\d+)/ },
    Bandwidth: { regex: /mBandwidth=(\d+)/ },
    MCC: { regex: /mMcc=(\d+)/ },
    MNC: { regex: /mMnc=(\d+)/ },
    Carrier: { regex: /mAlphaLong=(\w+)/ },
    "Carrier Short": { regex: /mAlphaShort=(\w+)/ },
    "CSS Supported": { regex: /mCssSupported=(\w+)/ },
    "Roaming Indicator": { regex: /mRoamingIndicator=(\d+)/ },
    "System In PRL": { regex: /mSystemIsInPrl=(\d+)/ },
    "Max Data Calls": { regex: /maxDataCalls\s*=\s*(\d+)/ },
    "DC-NR Restricted": { regex: /isDcNrRestricted\s*=\s*(\w+)/ },
    "NR Available": { regex: /isNrAvailable\s*=\s*(\w+)/ },
    "EN-DC Available": { regex: /isEnDcAvailable\s*=\s*(\w+)/ },
    "VoPS Support": { regex: /mVopsSupport\s*=\s*(\d+)/ },
    "EMC Bearer Support": { regex: /mEmcBearerSupport\s*=\s*(\d+)/ },
    "Signal RSSI": { regex: /rssi=(-?\d+)/ },
    "Signal RSRP": { regex: /rsrp=(-?\d+)/ },
    "Signal RSRQ": { regex: /rsrq=(-?\d+)/ },
    "Signal RSSNR": { regex: /rssnr=(-?\d+)/ },
    "Signal CQI": { regex: /cqi=(\d+)/ },
    "Signal TA": { regex: /ta=(\d+)/ },
    "Signal Level": { regex: /level=(\d+)/ },
    "Signal BER": { regex: /ber=(\d+)/ },
    "Call State": { regex: /mCallState=(\d+)/ },
    "Data State": { regex: /mDataConnectionState=(\d+)/ },
    "Data Activity": { regex: /mDataActivity=(\d+)/ },
    "Message Waiting": { regex: /mMessageWaiting=(\w+)/ },
    "Call Forwarding": { regex: /mCallForwarding=(\w+)/ },
    "Voice Activation": { regex: /mVoiceActivationState=\s*(\d+)/ },
    "Data Activation": { regex: /mDataActivationState=\s*(\d+)/ },
    "User Mobile Data": { regex: /mUserMobileDataState=\s*(\w+)/ },
    "SRVCC State": { regex: /mSrvccState=(-?\d+)/ },
    "OTASP Mode": { regex: /mOtaspMode=(\d+)/ },
    "Default Sub ID": { regex: /mDefaultSubId=(\d+)/ },
    "Default Phone ID": { regex: /mDefaultPhoneId=(\d+)/ },
    "Active Data Sub ID": { regex: /mActiveDataSubId=(\d+)/ },
    "Radio Power State": { regex: /mRadioPowerState=(\d+)/ },
    "Ringing Call State": { regex: /mRingingCallState=(\d+)/ },
    "Foreground Call State": { regex: /mForegroundCallState=(\d+)/ },
    "Background Call State": { regex: /mBackgroundCallState=(\d+)/ },
    "Carrier Network Change": { regex: /mCarrierNetworkChangeState=(\w+)/ },
    "Max Active Data": { regex: /maxActiveData=(\d+)/ },
    "Max 5G": { regex: /max5G=(\d+)/ },
  },
};

const WIFI_INFO: Section = {
  title: "WiFi Information",
  command: "dumpsys wifi",
  patterns: {
    "WiFi Status": { regex: /Wi-Fi is (\w+)/ },
    "Verbose Logging": { regex: /Verbose logging is (\w+)/ },
    "Stay Awake": { regex: /Stay-awake conditions:\s*(\d+)/ },
    "Idle Mode": { regex: /mInIdleMode\s+(\w+)/ },
    "Scan Pending": { regex: /mScanPending\s+(\w+)/ },
    Vendor: { regex: /Wi-Fi vendor:\s*([^\n]+)/ },
    "Supported Feature": { regex: /Supported feature:\s*(\d+)/ },
  },
};

const BATTERY_INFO: Section = {
  title: "Battery Information",
  command: "dumpsys battery",
  patterns: {
    "AC Powered": { regex: /AC powered:\s*(\w+)/ },
    "USB Powered": { regex: /USB powered:\s*(\w+)/ },
    "Wireless Powered": { regex: /Wireless powered:\s*(\w+)/ },
    "Max Charging Current": { regex: /Max charging current:\s*(\d+)/ },
    "Max Charging Voltage": { regex: /Max charging voltage:\s*(\d+)/ },
    "Charge Counter": { regex: /Charge counter:\s*(\d+)/ },
    Status: { regex: /status:\s*(\d+)/ },
    Health: { regex: /health:\s*(\d+)/ },
    Present: { regex: /present:\s*(\w+)/ },
    Level: { regex: /level:\s*(\d+)/ },
    Scale: { regex: /scale:\s*(\d+)/ },
    Voltage: { regex: /voltage:\s*(\d+)/ },
    Temperature: { regex: /temperature:\s*(\d+)/ },
    Technology: { regex: /technology:\s*(.+)/ },
    "Current Now": { regex: /current now:\s*(-?\d+)/ },
    "LED Charging": { regex: /LED Charging:\s*(\w+)/ },
    "LED Low Battery": { regex: /LED Low Battery:\s*(\w+)/ },
    "Fast Charging": { regex: /Adaptive Fast Charging Settings:\s*(\w+)/ },
    "Super Fast Charging": { regex: /Super Fast Charging Settings:\s*(\w+)/ },
  },
};

const NETSTATS_INFO: Section = {
  title: "Network Statistics",
  command: "dumpsys netstats",
  patterns: {
    "Active Interface": { regex: /Active interfaces:\s*\n\s*iface=(\w+)/ },
    "Interface Type": { regex: /type=(\w+)/ },
    "Interface SubType": { regex: /subType=(\w+)/ },
    Metered: { regex: /metered=(\w+)/ },
    "Default Network": { regex: /defaultNetwork=(\w+)/ },
    "Pending Bytes": { regex: /Pending bytes:\s*(\d+)/ },
  },
};

const NETPOLICY_INFO: Section = {
  title: "Network Policy",
  command: "dumpsys netpolicy",
  patterns: {
    "System Ready": { regex: /System ready:\s*(\w+)/ },
    "Restrict Background": { regex: /Restrict background:\s*(\w+)/ },
    "Restrict Power": { regex: /Restrict power:\s*(\w+)/ },
    "Device Idle": { regex: /Device idle:\s*(\w+)/ },
    "Metered Interfaces": { regex: /Metered ifaces:\s*\{([^}]+)\}/ },
    Charging: { regex: /Charging:\s*(\w+)/ },
  },
};

const PHONE_INFO: Section = {
  title: "Phone Information",
  command: "dumpsys phone",
  patterns: {
    "Phone ID": { regex: /PHONE_ID=(\d+)/ },
    "Subscription ID": { regex: /SUBSCRIPTION_ID=(\d+)/ },
    "Sort Order": { regex: /SORT_ORDER=(\d+)/ },
    "CS Video Calling": { regex: /CS_VIDEO_CALLING=(\w+)/ },
    "PS Video Calling": { regex: /PS_VIDEO_CALLING=(\w+)/ },
  },
};

const USB_INFO: Section = {
  title: "USB Information",
  command: "dumpsys usb",
  patterns: {
    "Boot Completed": { regex: /mBootCompleted:(\w+)/ },
    "SIM Count": { regex: /All SIM Count:(\d+)/ },
    "MPSM Support": { regex: /SUPPORT MPSM\s*:(\w+)/ },
    "MPSM Enabled": { regex: /MPSM ON\/OFF\s*:(\w+)/ },
    "SIM Block": { regex: /SIM BLOCK ON\/OFF\s*:(\w+)/ },
    "MDM Block": { regex: /MDM BLOCK ON\/OFF\s*:(\w+)/ },
    "Dex Mode": { regex: /DexModeObserver state:(\w+)/ },
    "Notification Ready": {
      regex: /Notification\s*:\s*\n\s*ready\s*:\s*(\w+)/,
    },
    Connected: { regex: /connected=(\w+)/ },
    Configured: { regex: /configured=(\w+)/ },
    "Current Mode": { regex: /current_mode=(\w+)/ },
    "Power Role": { regex: /power_role=(\w+)/ },
    "Data Role": { regex: /data_role=(\w+)/ },
    "USB Charging": { regex: /usb_charging=(\w+)/ },
    "Kernel State": { regex: /kernel_state=(\w+)/ },
    "Kernel Functions": { regex: /kernel_function_list=([^\s]+)/ },
    "Current Functions": {
      regex: /current_functions=\[\s*([^\]]+)\]/,
      transform: (m: RegExpMatchArray) =>
        (m[1] || "").trim().replace(/\s+/g, ", "),
    },
    "Functions Applied": { regex: /current_functions_applied=(\w+)/ },
    "Screen Unlocked Functions": { regex: /screen_unlocked_functions=(\w+)/ },
    "Screen Locked": { regex: /screen_locked=(\w+)/ },
    "Host Connected": { regex: /host_connected=(\w+)/ },
    "Source Power": { regex: /source_power=(\w+)/ },
    "Sink Power": { regex: /sink_power=(\w+)/ },
    "Hide Notification": { regex: /hide_usb_notification=(\w+)/ },
    "Audio Accessory": { regex: /audio_accessory_connected=(\w+)/ },
    "Num Connects": { regex: /num_connects=(\d+)/ },
    "Port ID": { regex: /id=(port\d+)/ },
    "Supported Modes": { regex: /supported_modes=(\w+)/ },
    "Simulation Active": { regex: /is_simulation_active=(\w+)/ },
    "Can Change Mode": { regex: /can_change_mode=(\w+)/ },
    "Can Change Power Role": { regex: /can_change_power_role=(\w+)/ },
    "Can Change Data Role": { regex: /can_change_data_role=(\w+)/ },
    "Contaminant Status": { regex: /contaminant_presence_status=([^\s]+)/ },
    "Connected At (ms)": { regex: /connected_at_millis=(\d+)/ },
    "ALSA Cards": { regex: /cards_parser=(-?\d+)/ },
  },
};

const BATTERY_EXT_INFO: Section = {
  title: "Battery Extended",
  command: "dumpsys battery",
  patterns: {
    "Misc Event": { regex: /batteryMiscEvent:\s*(\d+)/ },
    "Current Event": { regex: /batteryCurrentEvent:\s*(\d+)/ },
    "Plug Type Summary": { regex: /mSecPlugTypeSummary:\s*(\d+)/ },
    "Wireless Fast Charger": {
      regex: /mWirelessFastChargingSettingsEnable:\s*(\w+)/,
    },
    "Saved ASOC": { regex: /mSavedBatteryAsoc:\s*(\d+)/ },
    "Saved Max Temp": { regex: /mSavedBatteryMaxTemp:\s*(\d+)/ },
    "Saved Max Current": { regex: /mSavedBatteryMaxCurrent:\s*(\d+)/ },
    "Saved Usage": { regex: /mSavedBatteryUsage:\s*(\d+)/ },
  },
};

const DISPLAY_INFO: Section = {
  title: "Display Information",
  command: "dumpsys display",
  patterns: {
    "Display State": { regex: /mGlobalDisplayState=(\w+)/ },
    "Next Display ID": { regex: /mNextNonDefaultDisplayId=(\d+)/ },
    "Stable Display Size": {
      regex: /mStableDisplaySize=Point\((\d+),\s*(\d+)\)/,
      transform: (m: RegExpMatchArray) => `${m[1]}x${m[2]}`,
    },
    "WiFi Display Scan Count": { regex: /mWifiDisplayScanRequestCount=(\d+)/ },
    "WiFi Display Feature State": { regex: /featureState=(\d+)/ },
    "WiFi Display Scan State": { regex: /scanState=(\d+)/ },
    "WiFi P2P Enabled": { regex: /mWifiP2pEnabled=(\w+)/ },
    "WFD Enabled": { regex: /mWfdEnabled=(\w+)/ },
  },
};

const POWER_INFO: Section = {
  title: "Power Information",
  command: "dumpsys power",
  patterns: {
    Wakefulness: { regex: /mWakefulness=(\w+)/ },
    "Is Powered": { regex: /mIsPowered=(\w+)/ },
    "Plug Type": { regex: /mPlugType=(\d+)/ },
    "Battery Level": { regex: /mBatteryLevel=(\d+)/ },
    "Stay On": { regex: /mStayOn=(\w+)/ },
    "Boot Completed": { regex: /mBootCompleted=(\w+)/ },
    "System Ready": { regex: /mSystemReady=(\w+)/ },
    "Battery Level Low": { regex: /mBatteryLevelLow=(\w+)/ },
    "Light Device Idle Mode": { regex: /mLightDeviceIdleMode=(\w+)/ },
    "Device Idle Mode": { regex: /mDeviceIdleMode=(\w+)/ },
    "Display Ready": { regex: /mDisplayReady=(\w+)/ },
  },
};

const ALARM_INFO: Section = {
  title: "Alarm Information",
  command: "dumpsys alarm",
  patterns: {
    "Min Futurity": { regex: /min_futurity=\+([^\n]+)/ },
    "Min Interval": { regex: /min_interval=\+([^\n]+)/ },
    "Max Interval": { regex: /max_interval=\+([^\n]+)/ },
    "Max Alarms Per UID": { regex: /max_alarms_per_uid=(\d+)/ },
    "App Standby Enabled": { regex: /app_standby_quotas_enabled=(\w+)/ },
    "Force App Standby": { regex: /Force all apps standby:\s*(\w+)/ },
    "Plugged In": { regex: /Plugged In:\s*(\w+)/ },
  },
};

const SECTIONS: Section[] = [
  NETWORK_INFO,
  CELLULAR_INFO,
  WIFI_INFO,
  BATTERY_INFO,
  NETSTATS_INFO,
  NETPOLICY_INFO,
  PHONE_INFO,
  USB_INFO,
  BATTERY_EXT_INFO,
  DISPLAY_INFO,
  POWER_INFO,
  ALARM_INFO,
];

async function load(): Promise<Record<string, ParsedData>> {
  const data: Record<string, ParsedData> = {};

  for (const section of SECTIONS) {
    const result = await DroidNet.exec(section.command.split(" "));
    data[section.title] = parseWithPatterns(
      result.stdout || "",
      section.patterns,
    );
  }

  return data;
}

function render(data: Record<string, ParsedData>): HTMLElement[] {
  return SECTIONS.map((section) => {
    const sectionData = renderFromPatterns(data[section.title] || {});
    const rows = Object.entries(sectionData).map(([label, value]) => ({
      label,
      value,
    }));
    return rows.length > 0
      ? [
          UIRenderer.renderTitle(section.title),
          UIRenderer.renderTable(rows, { col: 6 }),
        ]
      : [];
  }).flat() as HTMLElement[];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend(
  DroidNet.createView({
    load,
    render: (data: Record<string, ParsedData> & DeviceStatus) => [render(data)],
  }),
);
