# Building luci-app-droidnet-scrcpy

## Prerequisites

- OpenWrt SDK 23.05.2 or later
- Node.js and NPM (for building)
- Build dependencies (see main README)

## Build Methods

### Method 1: Using build-package.sh (Recommended)

The build script automatically detects and builds the scrcpy package:

```bash
# From repository root
.github/tools/build-package.sh
```

**What it does:**
1. Checks for `scrcpy/` folder
2. Copies to OpenWrt SDK as `package/luci-app-droidnet-scrcpy`
3. Installs dependencies
4. Builds both main and scrcpy packages
5. Outputs IPK files to build directory

**Output:**
```
/tmp/luci-app-droidnet-build/
├── luci-app-droidnet_1.1.1_all.ipk
└── luci-app-droidnet-scrcpy_1.0.0_all.ipk
```

### Method 2: Manual Build

```bash
# Setup OpenWrt SDK
wget https://archive.openwrt.org/releases/23.05.2/targets/x86/64/openwrt-sdk-23.05.2-x86-64_gcc-12.3.0_musl.Linux-x86_64.tar.xz
tar -xJf openwrt-sdk-*.tar.xz
cd openwrt-sdk-*/

# Setup feeds
cat > feeds.conf << EOF
src-git base https://github.com/openwrt/openwrt.git;openwrt-23.05
src-git packages https://github.com/openwrt/packages.git;openwrt-23.05
src-git luci https://git.openwrt.org/project/luci.git;openwrt-23.05
EOF

./scripts/feeds update -a

# Copy packages
cp -r /path/to/luci-app-droidnet/dist package/luci-app-droidnet
cp -r /path/to/luci-app-droidnet/scrcpy package/luci-app-droidnet-scrcpy

# Install feeds
./scripts/feeds install luci-app-droidnet
./scripts/feeds install luci-app-droidnet-scrcpy

# Configure
cat > .config << EOF
CONFIG_PACKAGE_luci-app-droidnet=m
CONFIG_PACKAGE_luci-app-droidnet-scrcpy=m
CONFIG_LUCI_JSMIN=n
CONFIG_LUCI_CSSTIDY=n
EOF

make defconfig

# Build
make package/luci-app-droidnet/{clean,compile} -j$(nproc)
make package/luci-app-droidnet-scrcpy/{clean,compile} -j$(nproc)

# Find IPK files
find bin/packages -name "*.ipk"
```

### Method 3: GitHub Actions

Push to master branch triggers automatic build:

```bash
git add scrcpy/
git commit -m "Add scrcpy package"
git push origin master
```

**Workflow automatically:**
1. Detects scrcpy folder
2. Builds both packages
3. Uploads to GitHub Releases

## Build Configuration

### Main Package Dependencies

```makefile
DEPENDS:=+luci-base +luci-lib-jsonc +adb
```

### Scrcpy Package Dependencies

```makefile
DEPENDS:=+luci-app-droidnet +node +node-npm
```

## Package Sizes

**Estimated sizes:**
- `luci-app-droidnet`: ~50KB
- `luci-app-droidnet-scrcpy`: ~15-20MB (includes ws-scrcpy)

## Troubleshooting

### Build fails with "node not found"

Install Node.js in SDK:
```bash
./scripts/feeds install node node-npm
```

### ws-scrcpy fails to install

Check npm cache:
```bash
npm cache clean --force
```

### Package not found in feeds

Ensure package is copied correctly:
```bash
ls -la package/luci-app-droidnet-scrcpy/
```

## Testing Build

After building, test installation:

```bash
# Copy to OpenWrt device
scp luci-app-droidnet-scrcpy_*.ipk root@192.168.1.1:/tmp/

# Install on device
ssh root@192.168.1.1
opkg install /tmp/luci-app-droidnet-scrcpy_*.ipk

# Check service
/etc/init.d/droidnet-scrcpy start
logread | grep droidnet-scrcpy
```

## CI/CD Integration

The build system is integrated with GitHub Actions:

**Triggers:**
- Push to master
- Manual workflow dispatch
- Repository dispatch

**Artifacts:**
- Main package IPK
- Scrcpy package IPK (if folder exists)
- Uploaded to GitHub Releases

## Development Build

For faster development builds:

```bash
# Build only scrcpy package
cd openwrt-sdk/
make package/luci-app-droidnet-scrcpy/compile -j$(nproc)

# Skip dependency checks
make package/luci-app-droidnet-scrcpy/compile -j$(nproc) V=s
```

## Clean Build

Remove all build artifacts:

```bash
# Clean specific package
make package/luci-app-droidnet-scrcpy/clean

# Clean all
make clean
```
