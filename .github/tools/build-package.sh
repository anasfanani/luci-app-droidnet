#!/bin/bash
set -euo pipefail

# Check and install dependencies only if needed
REQUIRED_PKG=("build-essential" "clang" "flex" "bison" "g++" "gawk" "gcc-multilib" "g++-multilib" "gettext" "git" "libncurses-dev" "libssl-dev" "rsync" "unzip" "zlib1g-dev" "file" "wget")
MISSING_PKG=()

for pkg in "${REQUIRED_PKG[@]}"; do
    if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
        MISSING_PKG+=("$pkg")
    fi
done

if [ ${#MISSING_PKG[@]} -ne 0 ]; then
    echo "Installing missing dependencies: ${MISSING_PKG[*]}"
    export DEBIAN_FRONTEND=noninteractive
    sudo apt-get update -qq || true
    sudo apt-get install -y -qq "${MISSING_PKG[@]}" || {
        echo "Warning: Some packages failed to install, continuing anyway..."
    }
fi

# Setup build directory in /tmp
BUILD_DIR="${TMPDIR:-/tmp}/luci-app-droidnet-build"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$BUILD_DIR"

# Create symlink in repo root for easy access
rm -f "$(dirname "$0")/../../build"
ln -sf "$BUILD_DIR" "$(dirname "$0")/../../build"

cd "$BUILD_DIR"

# Download and setup OpenWrt SDK only if not exists
if [ ! -d "sdk" ]; then
    echo "Downloading OpenWrt SDK..."
    SDK_URL="https://archive.openwrt.org/releases/23.05.2/targets/x86/64/openwrt-sdk-23.05.2-x86-64_gcc-12.3.0_musl.Linux-x86_64.tar.xz"
    SDK_FILE=$(basename $SDK_URL)
    
    if [ ! -f "$SDK_FILE" ]; then
        wget $SDK_URL
    fi
    echo "Extracting OpenWrt SDK..."
    mkdir -p sdk && tar -xJf "$SDK_FILE" -C ./sdk --strip-components=1
fi

cd sdk

# Setup feeds only if not already configured
cat > feeds.conf << EOF
src-git base https://github.com/openwrt/openwrt.git;openwrt-23.05
src-git packages https://github.com/openwrt/packages.git;openwrt-23.05
src-git luci https://git.openwrt.org/project/luci.git;openwrt-23.05
src-git routing https://git.openwrt.org/feed/routing.git;openwrt-23.05
EOF

# Copy packages from dist (always update to latest)
rm -rf package/luci-app-droidnet
cp -r "$REPO_ROOT/dist" package/luci-app-droidnet

# Copy scrcpy package if exists
if [ -d "$REPO_ROOT/scrcpy" ]; then
    echo "Found scrcpy package, adding to build..."
    rm -rf package/luci-app-droidnet-scrcpy
    cp -r "$REPO_ROOT/scrcpy" package/luci-app-droidnet-scrcpy
fi

# Update feeds only if feeds directory doesn't exist
if [ ! -d "feeds" ]; then
    echo "Updating feeds..."
    ./scripts/feeds update -a
    echo "Installing initial config..."
    echo "CONFIG_PACKAGE_luci-app-droidnet=m" > .config
    echo "CONFIG_LUCI_JSMIN=n" >> .config
    echo "CONFIG_LUCI_CSSTIDY=n" >> .config
    ./scripts/feeds install -d n luci-app-droidnet
    make download -j"$(nproc)"
fi

./scripts/feeds install luci-app-droidnet

# Install scrcpy package if exists
if [ -d "package/luci-app-droidnet-scrcpy" ]; then
    echo "Installing scrcpy package..."
    ./scripts/feeds install luci-app-droidnet-scrcpy
fi

# Configure build
BUILD_SCRCPY=""
if [ -d "package/luci-app-droidnet-scrcpy" ]; then
    BUILD_SCRCPY="CONFIG_PACKAGE_luci-app-droidnet-scrcpy=m"
fi

cat > .config << EOF
CONFIG_ALL_NONSHARED=n
CONFIG_ALL_KMODS=n
CONFIG_ALL=n
CONFIG_AUTOREMOVE=n
CONFIG_LUCI_LANG_zh_Hans=n
CONFIG_LUCI_JSMIN=n
CONFIG_LUCI_CSSTIDY=n
CONFIG_PACKAGE_luci-app-droidnet=m
${BUILD_SCRCPY}
EOF

make defconfig
make download -j"$(nproc)"

# Build packages
make package/luci-app-droidnet/{clean,compile} -j"$(nproc)"

if [ -d "package/luci-app-droidnet-scrcpy" ]; then
    echo "Building scrcpy package..."
    make package/luci-app-droidnet-scrcpy/{clean,compile} -j"$(nproc)"
fi

echo "Build complete. IPK files are in $BUILD_DIR/sdk/bin/packages/x86_64/base/"

# Copy IPK files to build root directory
IPK_FILE=$(find "$BUILD_DIR/sdk/bin/packages/x86_64/base/" -name "luci-app-droidnet_*.ipk" | head -1)
if [ -n "$IPK_FILE" ]; then
    cp -f "$IPK_FILE" "$BUILD_DIR/"
    echo "Main package copied to: $BUILD_DIR/$(basename "$IPK_FILE")"
fi

SCRCPY_IPK=$(find "$BUILD_DIR/sdk/bin/packages/x86_64/base/" -name "luci-app-droidnet-scrcpy_*.ipk" | head -1)
if [ -n "$SCRCPY_IPK" ]; then
    cp -f "$SCRCPY_IPK" "$BUILD_DIR/"
    echo "Scrcpy package copied to: $BUILD_DIR/$(basename "$SCRCPY_IPK")"
fi
