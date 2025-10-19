# Comprehensive Extractable Fields from dumpsys

## connectivity (50+ fields available)

### Network Agent Info
- `networkId` - Network ID number
- `nethandle` - Network handle
- `networkType` - MOBILE[LTE], WIFI, etc
- `state` - CONNECTED/DISCONNECTED
- `reason` - Connection reason
- `extra` - Extra info (internet, etc)
- `failover` - Failover status
- `available` - Availability status
- `roaming` - Roaming status

### Link Properties
- `interfaceName` - rmnet0, wlan0, etc
- `ipAddress` - IP with subnet (10.122.202.243/24)
- `dnsServers` - Array of DNS servers
- `domains` - Domain name
- `mtu` - MTU size
- `tcpBufferSizes` - TCP buffer configuration
- `routes` - Routing table entries

### Network Capabilities
- `capabilities` - Full capability list (INTERNET, VALIDATED, etc)
- `transports` - CELLULAR, WIFI, BLUETOOTH, ETHERNET
- `bandwidthUp` - Upload bandwidth in Kbps
- `bandwidthDown` - Download bandwidth in Kbps
- `specifier` - Network specifier

### Network Status
- `score` - Network score
- `everValidated` - Ever validated status
- `lastValidated` - Last validated status
- `created` - Creation status
- `lingering` - Lingering status
- `explicitlySelected` - Explicit selection
- `acceptUnvalidated` - Accept unvalidated
- `everCaptivePortalDetected` - Captive portal detection
- `lastCaptivePortalDetected` - Last captive portal
- `captivePortalValidationPending` - Validation pending
- `partialConnectivity` - Partial connectivity
- `acceptPartialConnectivity` - Accept partial
- `clatState` - CLAT state (IDLE, etc)

### Tethering
- `subId` - Subscription ID
- `tetherableUsbRegexs` - USB tethering patterns
- `tetherableWifiRegexs` - WiFi tethering patterns
- `tetherableBluetoothRegexs` - Bluetooth tethering patterns
- `tetherableEthernetRegexs` - Ethernet tethering patterns
- `tetherableNcmRegexs` - NCM tethering patterns
- `isDunRequired` - DUN requirement
- `chooseUpstreamAutomatically` - Auto upstream
- `preferredUpstreamIfaceTypes` - Preferred upstream types
- `legacyDhcpRanges` - DHCP ranges
- `defaultIPv4DNS` - Default DNS servers
- `enableLegacyDhcpServer` - Legacy DHCP server
- `tetherState` - Current tether state per interface
- `upstreamInterface` - Current upstream interface

### Background Restriction
- `restrictBackground` - Background restriction status
- `uidRules` - Rules per UID (ALLOW_METERED, REJECT_ALL, etc)

## telephony.registry (60+ fields available)

### Service State
- `mVoiceRegState` - Voice registration (IN_SERVICE, OUT_OF_SERVICE, POWER_OFF)
- `mDataRegState` - Data registration state
- `mChannelNumber` - Channel number
- `duplexMode` - Duplex mode
- `mCellBandwidths` - Cell bandwidths array
- `isManualNetworkSelection` - Manual/automatic selection
- `getRilVoiceRadioTechnology` - Voice RAT (LTE, 3G, etc)
- `getRilDataRadioTechnology` - Data RAT
- `mCssIndicator` - CSS indicator
- `mCdmaRoamingIndicator` - CDMA roaming
- `mCdmaDefaultRoamingIndicator` - CDMA default roaming
- `VoiceRegType` - Voice registration type
- `ImsVoiceAvail` - IMS voice availability
- `Snap` - SNAP status
- `MobileVoice` - Mobile voice state
- `MobileVoiceRat` - Mobile voice RAT
- `MobileData` - Mobile data state
- `MobileDataRoamingType` - Roaming type (home, roaming)
- `MobileDataRat` - Mobile data RAT
- `PsOnly` - PS only mode
- `FemtocellInd` - Femtocell indicator
- `SprDisplayRoam` - Sprint display roam
- `EndcStatus` - EN-DC status
- `RestrictDcnr` - Restrict DC-NR
- `NrBearerStatus` - NR bearer status
- `5gStatus` - 5G status
- `RRCState` - RRC state
- `NrIconType` - NR icon type
- `mIsEmergencyOnly` - Emergency only mode
- `isUsingCarrierAggregation` - Carrier aggregation
- `mLteEarfcnRsrpBoost` - LTE EARFCN RSRP boost
- `mNrFrequencyRange` - NR frequency range
- `mIsIwlanPreferred` - IWLAN preferred

### Network Registration Info
- `domain` - CS/PS domain
- `transportType` - WWAN transport
- `registrationState` - HOME, NOT_REG_OR_SEARCHING, UNKNOWN
- `roamingType` - NOT_ROAMING, ROAMING
- `accessNetworkTechnology` - LTE, UNKNOWN, etc
- `rejectCause` - Reject cause
- `emergencyEnabled` - Emergency enabled
- `availableServices` - VOICE, SMS, VIDEO, DATA

### Cell Identity (LTE)
- `mCi` - Cell ID
- `mPci` - Physical Cell ID
- `mTac` - Tracking Area Code
- `mEarfcn` - EARFCN
- `mBandwidth` - Bandwidth
- `mMcc` - Mobile Country Code
- `mMnc` - Mobile Network Code
- `mAlphaLong` - Carrier name (long)
- `mAlphaShort` - Carrier name (short)

### Voice Specific Info
- `mCssSupported` - CSS supported
- `mRoamingIndicator` - Roaming indicator
- `mSystemIsInPrl` - System in PRL
- `mDefaultRoamingIndicator` - Default roaming indicator

### Data Specific Info
- `maxDataCalls` - Max data calls
- `isDcNrRestricted` - DC-NR restricted
- `isNrAvailable` - NR available
- `isEnDcAvailable` - EN-DC available
- `mVopsSupport` - VoPS support
- `mEmcBearerSupport` - EMC bearer support

### Signal Strength
- `rssi` - RSSI value
- `rsrp` - RSRP value
- `rsrq` - RSRQ value
- `rssnr` - RSSNR value
- `cqi` - CQI value
- `ta` - Timing Advance
- `level` - Signal level (0-4)
- `ber` - Bit Error Rate

### Call State
- `mCallState` - Call state (0=idle)
- `mRingingCallState` - Ringing call state
- `mForegroundCallState` - Foreground call state
- `mBackgroundCallState` - Background call state
- `mPreciseCallState` - Precise call state
- `mCallDisconnectCause` - Disconnect cause
- `mCallIncomingNumber` - Incoming number
- `mCallPreciseDisconnectCause` - Precise disconnect cause

### Data Connection
- `mDataConnectionState` - 0=disconnected, 2=connected
- `mDataActivity` - Data activity (0=none, 1=in, 2=out, 3=inout)
- `mPreciseDataConnectionState` - Detailed data connection state
- `mCallNetworkType` - Call network type

### Other
- `mMessageWaiting` - Message waiting indicator
- `mCallForwarding` - Call forwarding status
- `mVoiceActivationState` - Voice activation
- `mDataActivationState` - Data activation
- `mUserMobileDataState` - User mobile data state
- `mCellLocation` - Cell location bundle
- `mCellInfo` - Detailed cell info array
- `mImsCallDisconnectCause` - IMS call disconnect
- `mSrvccState` - SRVCC state
- `mOtaspMode` - OTASP mode
- `mCallQuality` - Call quality metrics
- `mDefaultSubId` - Default subscription ID
- `mDefaultPhoneId` - Default phone ID
- `mApnBlackList` - APN blacklist
- `mCarrierNetworkChangeState` - Carrier network change
- `mPhoneCapability` - Phone capability
- `mActiveDataSubId` - Active data subscription
- `mRadioPowerState` - Radio power state
- `mEmergencyNumberList` - Emergency numbers

## Recommendation

Extract ALL these fields and let the renderer decide what to show. This gives maximum flexibility for future features.
