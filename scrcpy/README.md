# luci-app-droidnet-scrcpy

Screen mirroring and remote control for Android devices using [ws-scrcpy](https://github.com/NetrisTV/ws-scrcpy).

## Features

- 🖥️ **Screen Mirroring** - View Android screen in browser
- 🖱️ **Full Control** - Touch, keyboard, and mouse input
- 🎮 **Low Latency** - ~100-300ms delay
- 🌐 **Web-Based** - No client app needed
- 📱 **Multi-Device** - Support multiple devices
- 🔄 **Auto-Reconnect** - Handles connection drops

## Requirements

- `luci-app-droidnet` - Main DroidNet package
- `node` - Node.js runtime
- `node-npm` - NPM package manager
- Android device with ADB enabled

## Installation

### From IPK Package

```bash
opkg update
opkg install luci-app-droidnet-scrcpy
```

### From Source

```bash
# Build package
cd luci-app-droidnet/scrcpy
make package/luci-app-droidnet-scrcpy/compile

# Install
opkg install bin/packages/*/luci/luci-app-droidnet-scrcpy_*.ipk
```

## Usage

1. **Configure Device**
   - Navigate to **DroidNet → Device**
   - Select your Android device

2. **Start Service**
   - Navigate to **DroidNet → Screen Mirror**
   - Click "Start Service"

3. **View Screen**
   - Screen will appear in iframe
   - Click "Open in fullscreen" for better experience

4. **Control Device**
   - Click/tap to touch
   - Type to send keyboard input
   - Scroll to scroll
   - Right-click for back button

## Configuration

Edit `/etc/config/droidnet-scrcpy`:

```
config server 'server'
	option enabled '1'
	option port '8000'
	option max_fps '60'
	option bit_rate '8000000'
```

**Options:**
- `enabled` - Enable/disable service (0/1)
- `port` - WebSocket server port (default: 8000)
- `max_fps` - Maximum frame rate (default: 60)
- `bit_rate` - Video bitrate in bps (default: 8000000)

## Service Management

```bash
# Start service
/etc/init.d/droidnet-scrcpy start

# Stop service
/etc/init.d/droidnet-scrcpy stop

# Restart service
/etc/init.d/droidnet-scrcpy restart

# Enable on boot
/etc/init.d/droidnet-scrcpy enable

# Disable on boot
/etc/init.d/droidnet-scrcpy disable

# Check status
/etc/init.d/droidnet-scrcpy status
```

## Troubleshooting

### Service won't start

```bash
# Check device is configured
uci get droidnet.device.id

# Check ADB connection
adb devices

# Check logs
logread | grep droidnet-scrcpy
```

### Black screen

- Check device screen is on
- Try restarting service
- Check device permissions (screen capture)

### High latency

- Reduce `max_fps` to 30
- Reduce `bit_rate` to 4000000
- Check network connection
- Close other applications

### Input not working

- Ensure device has input permissions
- Try restarting device
- Check ADB connection

## Architecture

```
┌─────────────┐
│   Android   │
│   Device    │
└──────┬──────┘
       │ ADB
       ▼
┌─────────────┐
│   OpenWrt   │
│             │
│ ws-scrcpy   │ Node.js server
│   server    │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────┐
│   Browser   │
│   (LuCI)    │
└─────────────┘
```

## Performance

**Typical Performance:**
- Latency: 100-300ms
- FPS: 30-60
- Bitrate: 4-8 Mbps
- CPU: 20-40% (router)
- RAM: 50-100MB

**Optimization Tips:**
- Lower FPS for slower devices
- Reduce bitrate for slow networks
- Use wired connection when possible
- Close unused applications

## Development

### Build from source

```bash
cd scrcpy/src
npm install
npm start
```

### Test locally

```bash
node server.js --port 8000 --udid <device-id>
```

### Update ws-scrcpy

```bash
cd scrcpy/src
npm update ws-scrcpy
```

## License

Apache-2.0

## Credits

- [ws-scrcpy](https://github.com/NetrisTV/ws-scrcpy) - Web-based scrcpy
- [scrcpy](https://github.com/Genymobile/scrcpy) - Original scrcpy project
- [DroidNet](https://github.com/animegasan/luci-app-droidmodem) - Main project

## Support

- Issues: https://github.com/animegasan/luci-app-droidmodem/issues
- Discussions: https://github.com/animegasan/luci-app-droidmodem/discussions
