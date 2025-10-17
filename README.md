<div align="center">
  <h1>LuCI support for Android Modem</h1>
  <h3>Manage Android modem and optimize network settings.</h3>
</div>
<hr/>
<div align="center">
  <img alt="License" src="https://img.shields.io/github/license/animegasan/luci-app-droidmodem?style=for-the-badge">
  <img alt="Forks" src="https://img.shields.io/github/forks/animegasan/luci-app-droidmodem?style=for-the-badge">
  <img alt="Release" src="https://img.shields.io/github/v/release/animegasan/luci-app-droidmodem?style=for-the-badge">
  <img alt="Downloads" src="https://img.shields.io/github/downloads/animegasan/luci-app-droidmodem/total?style=for-the-badge">
</div>
<br/>
<div align="center">
  <a target="_blank" href="https://saweria.co/animegasan" alt="Saweria"><img src="https://img.shields.io/badge/saweria-donation?style=for-the-badge&logo=adobeindesign&labelColor=black&color=%23FFA401"></a>
  <a target="_blank" href="https://www.paypal.com/paypalme/animegasan" alt="PayPal"><img src="https://img.shields.io/badge/paypal-donation?style=for-the-badge&logo=paypal&labelColor=black&color=%23003087"></a>
  <a target="_blank" href="https://www.buymeacoffee.com/animegasan" alt="BuyMeACoffee"><img src="https://img.shields.io/badge/buy%20me%20a%20coffee-donation?style=for-the-badge&logo=buymeacoffee&labelColor=black&color=%23FFDD00"></a>
</div>
<hr/>

DroidModem is an application designed specifically for managing and optimizing network settings on Android modems. With advanced features, DroidModem allows users to have full control over their network connectivity and modem performance, ensuring a better user experience and more stable connections.

## 📥 | Install via Terminal

```
curl -s https://raw.githubusercontent.com/animegasan/luci-app-droidmodem/master/install | sh
```

## 📱 | Supported Devices

- Android version 10 or greater
- Rooted Android for version 10 and lower

## 🎯 | Recommended Magisk Modules

<table>
  <thead align="center">
    <tr border: none;>
      <td><b>📦 Name</b></td>
      <td><b>✍️ Description</b></td>
      <td><b>⬇️ Downloads</b></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>ADB Root Enabler</b></td>
      <td>Enable unauthenticated adb daemon, useful for devices with a broken screen!</td>
      <td><a target="_blank" href="https://github.com/anasfanani/Adb-Root-Enabler"><img alt="Downloads" src="https://img.shields.io/github/downloads/anasfanani/Adb-Root-Enabler/total?style=flat-square&label=Downloads&labelColor=343b41"/></a></td>
    </tr>
    <tr>
      <td><b>Magisk Autoboot</b></td>
      <td>Enable automatic booting of your Android device when it's connected to a charger or USB.</td>
      <td><a target="_blank" href="https://github.com/anasfanani/magisk-autoboot"><img alt="Downloads" src="https://img.shields.io/github/downloads/anasfanani/magisk-autoboot/total?style=flat-square&label=Downloads&labelColor=343b41"/></a></td>
    </tr>
    <tr>
      <td><b>Input Power Control</b></td>
      <td>Automatically switches charging off when battery level reaches a certain disable threshold and back on as soon as it drowns to enable threshold.</td>
      <td><a target="_blank" href="https://github.com/Magisk-Modules-Repo/IPControl"><img alt="Downloads" src="https://img.shields.io/github/downloads/Magisk-Modules-Repo/IPControl/latest/total?style=flat-square&label=Downloads&labelColor=343b41"/></a></td>
    </tr>
  </tbody>
</table>

## ✨ | Features

### 📊 | Monitoring Service

Tracks network activity on Android modem, automatically restarts networks including tunnel services such as Neko, OpenClash, Passwall, and V2Ray based on predefined configurations. Supports ping via methods such as HTTP, HTTPS, TCP, and ICMP. Continuous monitoring can maintain optimal network connectivity, reducing risk of disruption and downtime.

### ℹ️ | Information Service

Provides comprehensive information about various aspects of Android modem, ensuring access to important details about device performance and connectivity. This includes device details such as model, manufacturer, and operating system version, battery information such as current charge level and battery health, insights about wireless connectivity such as Wi-Fi networks, and information about cellular connectivity such as network provider.

<details><summary>Screenshoot</summary>
 <p>
  <img src="https://github.com/animegasan/luci-app-droidmodem/assets/14136053/5a1129a5-1106-4e69-8222-848228e43e6b">
 </p>
</details>

### 📶 | Mobile Network

Displays IP address of Android modem, status of wireless connection, mobile data, and airplane mode. Ypu can manually enable or disable wireless connection, mobile data, and airplane mode as needed.

<details><summary>Screenshoot</summary>
 <p>
  <img src="https://github.com/animegasan/luci-app-droidmodem/assets/14136053/d9451e7a-9117-45b2-8944-9eab5cf97da0">
 </p>
</details>

### ⚡ | Power Options and Application Manager

- Power Options<br>
  Gives full control over power operations of Android modem, allowing management of different power modes from one easily accessible place. You can shut down device, restart it, reboot device to enter fastboot mode, and reboot device to enter recovery mode.
- Application Manager<br>
Manage applications installed on Android modem, adding necessary applications to enhance functionality or support specific needs and removing unnecessary applications for optimal device performance.
   <details><summary>Screenshoot</summary>
    <p>
     <img src="https://github.com/animegasan/luci-app-droidmodem/assets/14136053/8ae4f4e4-1e87-4462-9fb1-11c879bcc4d4">
    </p>
   </details>

### 📩 | Inbox Messages

View all incoming messages received by Android modem, including sender information, message content, and reception date. Useful for monitoring important messages without need for a separate device. Using [ShellMS](https://github.com/try2codesecure/ShellMS) for efficient messaging, leveraging its capabilities to enhance communication directly from the development environment.

<details><summary>Screenshoot</summary>
 <p>
  <img src="https://github.com/animegasan/luci-app-droidmodem/assets/14136053/8816329b-f8eb-47a0-a292-bb6bf8073f4d">
 </p>
</details>

## Development

```sh
curl -fsSL https://bun.com/install | sudo bash
source ~/.bashrc
bun install
```
### Testing

#### OpenWRT Host
```
opkg install luci-mod-rpc
```
#### Run Tests
```
# Require NodeJS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install --lts



npx playwright install --with-deps --only-shell

# Run all tests:
npm run test:e2e

# Run specific pages:
TEST_PAGES="Device" npm run test:e2e
TEST_PAGES="Device,Network" npm run test:e2e
TEST_PAGES="Device,Network,Service" npm run test:e2e
```