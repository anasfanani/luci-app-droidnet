# Network Information Gathering from dumpsys

## Services to Extract

### connectivity ✓ (sample extracted)
**Available Data:**
- Active network ID and type (MOBILE/WIFI)
- Network state (CONNECTED/DISCONNECTED)
- Interface name (rmnet0, wlan0)
- IP address (LinkAddresses)
- DNS servers (DnsAddresses)
- MTU size
- TCP buffer sizes
- Routes (gateway, subnet)
- Network capabilities (INTERNET, VALIDATED, NOT_ROAMING, etc)
- Link bandwidth (up/down)
- Network score
- Tethering configuration
- USB/WiFi tethering regex patterns
- Network requests per UID
- Background restriction status

**Useful Fields:**
```
InterfaceName: rmnet0
LinkAddresses: [ 10.122.202.243/24 ]
DnsAddresses: [ /112.215.203.246 ]
MTU: 1500
Routes: [ 0.0.0.0/0 -> 10.122.202.1 rmnet0 ]
Capabilities: INTERNET&VALIDATED&NOT_ROAMING
LinkUpBandwidth>=15000Kbps
LinkDnBandwidth>=30000Kbps
```

### wifi ✓ (sample extracted)
**Available Data:**
- WiFi enabled/disabled status
- WiFi vendor (Broadcom, Qualcomm, etc)
- Supported features
- WiFi API call history (who enabled/disabled)
- Last control package name
- WiFi controller state history
- Airplane mode toggle history

**Useful Fields:**
```
Wi-Fi is disabled/enabled
Wi-Fi vendor: Broadcom
lastControlTime: packageName: com.android.shell
```

### telephony.registry ✓ (sample extracted)
**Available Data:**
- Call state (idle, ringing, offhook)
- Service state (IN_SERVICE, OUT_OF_SERVICE)
- Voice/Data registration state
- Network type (LTE, 3G, 5G)
- Roaming status
- Signal strength (RSSI, RSRP, RSRQ, RSSNR)
- Cell info (Cell ID, TAC, EARFCN, PCI)
- MCC/MNC (510/11 = XL Indonesia)
- Carrier name (mAlphaLong, mAlphaShort)
- Data connection state
- Data activity (NONE, IN, OUT, INOUT)
- Emergency only mode
- Carrier aggregation status
- 5G status (NR state, frequency range)
- IMS voice availability
- VoLTE support
- Cell location
- Message waiting indicator
- Call forwarding status

**Useful Fields:**
```
mServiceState: IN_SERVICE
getRilDataRadioTechnology: LTE
mSignalStrength: rssi=-85 rsrp=-84 rsrq=-7 rssnr=10 level=2
mCellInfo: mCi=66723595 mTac=55711 mEarfcn=39250
mMcc=510 mMnc=11 mAlphaLong=XL
mDataConnectionState=2 (CONNECTED)
isUsingCarrierAggregation=true
mNrFrequencyRange=-1 (not on 5G)
```

### phone
**Expected Data:**
- IMEI/MEID
- Phone number
- SIM state (READY, ABSENT, PIN_REQUIRED)
- Operator name
- Network operator code
- SIM operator
- Voice mail number
- Line 1 number
- Subscriber ID

### iphonesubinfo
**Expected Data:**
- IMSI (International Mobile Subscriber Identity)
- ICCID (SIM card number)
- Device ID (IMEI)
- Phone number
- Group ID Level 1
- MSISDN

### netstats
**Expected Data:**
- Data usage per UID/app
- Total RX/TX bytes
- Mobile data usage
- WiFi data usage
- Foreground/background usage
- Historical data usage
- Data usage by interface

### netpolicy
**Expected Data:**
- Data saver mode status
- Restricted UIDs
- Metered networks
- Network policies per UID
- Power save whitelist
- App standby status

### dnsresolver
**Expected Data:**
- DNS servers per network
- DNS cache entries
- DNS query statistics
- Private DNS configuration

### carrier_config
**Expected Data:**
- APN settings (name, type, proxy, port)
- Carrier name
- MCC/MNC
- VoLTE enabled
- WiFi calling enabled
- Data roaming enabled
- Carrier specific features

### network_management
**Expected Data:**
- Network interfaces list
- Interface configuration
- Firewall rules
- NAT rules
- Bandwidth control

### netd
**Expected Data:**
- Network daemon status
- Interface statistics
- Routing table
- DNS configuration
- Bandwidth quotas

## Additional Useful Services

### battery
- Battery level
- Charging status
- Battery health
- Temperature
- Voltage

### location
- GPS status
- Location providers
- Last known location
- Network location

### usb
- USB connection state
- USB tethering status
- USB configuration

## Extraction Priority

1. **High Priority** (Core network info)
   - connectivity
   - telephony.registry
   - wifi
   - netstats

2. **Medium Priority** (Detailed info)
   - phone
   - iphonesubinfo
   - carrier_config
   - netpolicy

3. **Low Priority** (Advanced/Debug)
   - dnsresolver
   - network_management
   - netd
