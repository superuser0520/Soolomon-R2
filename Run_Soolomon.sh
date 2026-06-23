#!/bin/bash
# =======================================================
#          S O O L O M O N  --  P O R T A B L E (LINUX)
# =======================================================
# Portable launcher for Linux IPC target machines.
# Automatically bypasses FAT32/exFAT noexec file system limits.

clear
echo "======================================================="
echo "         S O O L O M O N  --  P O R T A B L E (LINUX)"
echo "======================================================="
echo " - Portability Mode: Active (USB Dongle)"
echo " - OS Platform: Linux (x86_64)"
echo "======================================================="
echo ""

# Find the directory where this script sits
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Target binary name
BINARY_NAME="Soolomon-linux"
TARGET_PATH="$DIR/$BINARY_NAME"

# Check if the binary exists in directory
if [ ! -f "$TARGET_PATH" ]; then
    # Fallback check for "Soolomon" without suffix
    if [ -f "$DIR/Soolomon" ]; then
        BINARY_NAME="Soolomon"
        TARGET_PATH="$DIR/$BINARY_NAME"
    else
        echo "[ERROR] Linux portable binary ($BINARY_NAME) was not found in: $DIR"
        echo "Please compile it using Vercel 'pkg' or verify your file names."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Create secure temp folder on native Linux fs to avoid USB fat32/exfat 'noexec' mount limits
TEMP_DIR="/tmp/soolomon_portable"
mkdir -p "$TEMP_DIR"

echo " -> Preparing portable environment..."
echo " -> Copying binary to host storage to bypass USB mount lock..."
cp "$TARGET_PATH" "$TEMP_DIR/Soolomon-linux"

echo " -> Applying execute permissions..."
chmod +x "$TEMP_DIR/Soolomon-linux"

echo " -> Launching system server..."
echo "======================================================="
echo " Soolomon server is booting..."
echo " To stop the server gracefully, close this window or press Ctrl+C."
echo "======================================================="
echo ""

# Launch the binary from temp location and forward arguments (e.g. --open)
"$TEMP_DIR/Soolomon-linux" --open "$@"

# Clean up temp binary on exit
echo ""
echo " -> Cleaning up temp directories..."
rm -f "$TEMP_DIR/Soolomon-linux"
echo " -> Complete. Safe to unplug USB dongle."
