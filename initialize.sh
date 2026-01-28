#!/bin/bash

# --- 1. Root Check ---
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit
fi

echo "--- Raspberry Pi Startup Setup ---"

# --- 2. Node.js & NPM Check/Install ---
echo "Checking for Node.js and npm..."

if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo " - Node.js ($NODE_VERSION) is already installed."
    echo " - npm is already installed."
else
    echo " ! Node.js or npm not found. Attempting to install..."
    
    # Check for internet connectivity (ping google)
    if ping -q -c 1 -W 1 8.8.8.8 >/dev/null; then
        apt-get update
        apt-get install -y nodejs npm
        
        if [ $? -eq 0 ]; then
            echo " - Installation successful!"
        else
            echo " - Error: Installation failed. Please check your internet connection."
        fi
    else
        echo " - Error: No internet connection detected. Cannot install Node.js."
        echo "   (Skipping installation and proceeding to AP setup...)"
    fi
fi

echo ""
echo "--- Access Point Configuration ---"

# --- 3. NetworkManager Check ---
if ! command -v nmcli &> /dev/null; then
    echo "Error: NetworkManager (nmcli) is not installed."
    echo "This script requires Raspberry Pi OS 'Bookworm' or newer."
    exit 1
fi

# --- 4. Auto-detect Wi-Fi Interface ---
INTERFACE=$(nmcli device | grep "wifi" | head -n 1 | awk '{print $1}')

if [ -z "$INTERFACE" ]; then
    echo "Error: No Wi-Fi interface detected!"
    exit 1
fi

echo "Detected Wi-Fi Interface: $INTERFACE"
echo ""

# --- 5. User Prompts ---
read -p "Enter the desired Access Point Name (SSID): " AP_SSID
if [ -z "$AP_SSID" ]; then
    echo "Error: SSID cannot be empty."
    exit 1
fi

while true; do
    read -p "Enter the Password (min 8 chars): " AP_PASSWORD
    if [ ${#AP_PASSWORD} -ge 8 ]; then
        break
    else
        echo "Password is too short. Try again."
    fi
done

# --- 6. Configure AP ---
echo ""
echo "Configuring Hotspot '$AP_SSID' on $INTERFACE..."

# Remove old connection if it exists to prevent duplicates
if nmcli connection show "Hotspot" &> /dev/null; then
    nmcli connection delete "Hotspot"
fi

# Create new connection
nmcli con add type wifi ifname "$INTERFACE" con-name "Hotspot" autoconnect yes ssid "$AP_SSID" > /dev/null

# Set Mode (AP), Security (WPA2), and Band (2.4GHz)
nmcli con modify "Hotspot" 802-11-wireless.mode ap
nmcli con modify "Hotspot" wifi-sec.key-mgmt wpa-psk
nmcli con modify "Hotspot" wifi-sec.psk "$AP_PASSWORD"
nmcli con modify "Hotspot" 802-11-wireless.band bg
# 'ipv4.method shared' is the default for new Hotspots in NM, but we can force it to be safe:
nmcli con modify "Hotspot" ipv4.method shared

echo "Bringing up the connection..."
nmcli con up "Hotspot"

echo ""
echo "------------------------------------------------"
echo "Setup Complete!"
echo "Node Status: $(node -v 2>/dev/null || echo 'Not Installed')"
echo "AP SSID:     $AP_SSID"
echo "------------------------------------------------"